
-- 1) Tighten user_profiles SELECT policy: drop chats and calls branches so only
--    the profile owner, admins, and saved-contact relationships can read rows.
--    Chat/call participant displays already go through get_public_profile_snippets RPC.
DROP POLICY IF EXISTS users_select_related_profiles ON public.user_profiles;

CREATE POLICY users_select_related_profiles
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.is_admin_user()
  OR EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.user_id = auth.uid() AND c.contact_id = user_profiles.id
  )
);

-- 2) Fix chat-media DELETE policy: require chat participation like UPDATE,
--    with a narrow exception for master-admin broadcast files (uid/broadcast-*).
DROP POLICY IF EXISTS "Users delete own chat media" ON storage.objects;

CREATE POLICY "Users delete own chat media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (
    (
      (storage.foldername(name))[2] IS NOT NULL
      AND public.is_chat_participant(((storage.foldername(name))[2])::uuid)
    )
    OR (
      array_length(storage.foldername(name), 1) = 1
      AND split_part(name, '/', 2) LIKE 'broadcast-%'
      AND public.is_master_admin()
    )
  )
);

-- 3) Tighten broadcast-upload INSERT policy: keep uid-scoped folder, broadcast- prefix,
--    disallow path traversal, and cap to exactly one folder segment.
DROP POLICY IF EXISTS "Master admin can upload broadcast chat media" ON storage.objects;

CREATE POLICY "Master admin can upload broadcast chat media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND public.is_master_admin()
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND array_length(storage.foldername(name), 1) = 1
  AND split_part(name, '/', 2) LIKE 'broadcast-%'
  AND position('..' in name) = 0
);
