
-- 1) Rewrite users_select_related_profiles: drop blocked_users + chat_members co-member branches
DROP POLICY IF EXISTS "users_select_related_profiles" ON public.user_profiles;
CREATE POLICY "users_select_related_profiles" ON public.user_profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.is_admin_user()
  OR EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.user_id = auth.uid() AND c.contact_id = user_profiles.id
  )
  OR EXISTS (
    SELECT 1 FROM public.chats ch
    WHERE (ch.participant_one = auth.uid() AND ch.participant_two = user_profiles.id)
       OR (ch.participant_two = auth.uid() AND ch.participant_one = user_profiles.id)
  )
  OR EXISTS (
    SELECT 1 FROM public.calls cl
    WHERE (cl.caller_id = auth.uid() AND cl.callee_id = user_profiles.id)
       OR (cl.callee_id = auth.uid() AND cl.caller_id = user_profiles.id)
  )
);

-- 2) Revoke sensitive column reads from authenticated
REVOKE SELECT (mobile_number, email) ON public.user_profiles FROM authenticated;

-- 3) Public snippet RPC for co-member/tribe/group display lookups (safe fields only)
CREATE OR REPLACE FUNCTION public.get_public_profile_snippets(_ids uuid[])
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  profile_photo_visibility text,
  is_verified boolean,
  is_online boolean,
  last_seen timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.full_name, up.username, up.avatar_url,
         up.profile_photo_visibility, up.is_verified, up.is_online, up.last_seen
    FROM public.user_profiles up
   WHERE auth.uid() IS NOT NULL
     AND up.id = ANY(_ids);
$$;
GRANT EXECUTE ON FUNCTION public.get_public_profile_snippets(uuid[]) TO authenticated;

-- 4) RPC for the caller's own saved contacts (includes mobile_number for display)
CREATE OR REPLACE FUNCTION public.get_my_saved_contact_profiles(_ids uuid[])
RETURNS TABLE (
  id uuid,
  full_name text,
  mobile_number text,
  avatar_url text,
  profile_photo_visibility text,
  is_verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.full_name, up.mobile_number, up.avatar_url,
         up.profile_photo_visibility, up.is_verified
    FROM public.user_profiles up
   WHERE auth.uid() IS NOT NULL
     AND up.id = ANY(_ids)
     AND EXISTS (
       SELECT 1 FROM public.contacts c
       WHERE c.user_id = auth.uid()
         AND c.contact_id = up.id
     );
$$;
GRANT EXECUTE ON FUNCTION public.get_my_saved_contact_profiles(uuid[]) TO authenticated;

-- 5) Tighten master-admin broadcast chat-media upload path (require broadcast-* filename, single folder segment)
DROP POLICY IF EXISTS "Master admin can upload broadcast chat media" ON storage.objects;
CREATE POLICY "Master admin can upload broadcast chat media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND array_length(storage.foldername(name), 1) = 1
  AND split_part(name, '/', 2) LIKE 'broadcast-%'
  AND public.is_master_admin()
);
