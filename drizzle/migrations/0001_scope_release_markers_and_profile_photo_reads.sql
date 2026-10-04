-- Release markers remain visible to visitors, but only the latest safe fields
-- are returned through a deliberately narrow definer function.
CREATE OR REPLACE FUNCTION public.latest_app_release_marker()
RETURNS TABLE (id uuid, version text, released_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT r.id, r.version, r.released_at
  FROM public.app_releases AS r
  ORDER BY r.released_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.latest_app_release_marker() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.latest_app_release_marker() TO anon, authenticated, service_role;

-- The security-invoker view cannot expose markers without a blanket base-table
-- SELECT rule, so retire its client access after switching clients to the RPC.
REVOKE ALL ON public.app_releases_public FROM anon, authenticated;
REVOKE ALL ON public.app_releases FROM anon;
REVOKE ALL ON public.app_releases FROM authenticated;
GRANT SELECT ON public.app_releases TO authenticated;
DROP POLICY IF EXISTS "Public can read release markers" ON public.app_releases;
-- Admins keep full-row reads under their existing SELECT policy.

-- Each private profile object must really belong to the named account;
-- shared assets have distinct, audience-specific read paths.
DROP POLICY IF EXISTS "Profile photos respect visibility settings" ON storage.objects;
CREATE POLICY "Owners read own profile files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-photos' AND owner_id = (SELECT auth.uid()::text)
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
CREATE POLICY "Master reads profile files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-photos' AND public.is_master_admin());
CREATE POLICY "Readers see published broadcast avatar"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = 'broadcast'
  AND public.is_authenticated_broadcast_reader());
CREATE POLICY "Readers see published broadcast attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-photos'
  AND (storage.foldername(name))[2] = 'broadcasts'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND owner_id = (storage.foldername(name))[1]
  AND public.is_authenticated_broadcast_reader()
  AND EXISTS (
    SELECT 1 FROM public.broadcast_messages bm
    WHERE split_part(split_part(bm.attachment_url, '/profile-photos/', 2), '?', 1) = name
  ));
CREATE POLICY "Members see tribe avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND owner_id = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] = 'tribes'
  AND (storage.foldername(name))[3] ~ '^[0-9a-fA-F-]{36}$'
  AND public.is_chat_participant(((storage.foldername(name))[3])::uuid));
CREATE POLICY "Viewers see permitted profile photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND owner_id = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] IS NULL
  AND public.can_view_profile_photo(((storage.foldername(name))[1])::uuid, auth.uid()));