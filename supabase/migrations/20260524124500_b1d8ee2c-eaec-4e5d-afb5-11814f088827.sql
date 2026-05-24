-- 1. Fix the self-referential WITH CHECK on admin_update_any_profile
DROP POLICY IF EXISTS admin_update_any_profile ON public.user_profiles;
CREATE POLICY admin_update_any_profile
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (
    public.is_admin_user()
    AND (
      public.is_master_admin()
      OR (
        role = (SELECT up.role FROM public.user_profiles up WHERE up.id = user_profiles.id)
        AND is_master_admin = (SELECT up.is_master_admin FROM public.user_profiles up WHERE up.id = user_profiles.id)
      )
    )
  );

-- 2. Hide the auth email column from other authenticated users.
-- Owners read it through get_my_full_profile() (SECURITY DEFINER) and
-- admins through admin_get_user_profile / admin_list_user_profiles.
REVOKE SELECT (email) ON public.user_profiles FROM anon, authenticated, PUBLIC;

-- 3. Add an UPDATE policy on chat-media scoped to the uploader's folder.
DROP POLICY IF EXISTS "Users update own chat media" ON storage.objects;
CREATE POLICY "Users update own chat media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 4. Restrict storage-API listing of chat-media to participants of the chat
-- encoded in the path (uploaders use path `<uploaderId>/<chatId>/...`).
-- Note: the bucket is public, so direct public URLs still work for anyone
-- holding the URL — media payloads are E2E encrypted at rest, so the
-- ciphertext is what would be exposed. This tighter SELECT prevents
-- enumeration/listing by non-participants.
DROP POLICY IF EXISTS "Authenticated read chat media" ON storage.objects;
CREATE POLICY "Participants read chat media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR (
        (storage.foldername(name))[2] IS NOT NULL
        AND public.is_chat_participant(((storage.foldername(name))[2])::uuid)
      )
    )
  );