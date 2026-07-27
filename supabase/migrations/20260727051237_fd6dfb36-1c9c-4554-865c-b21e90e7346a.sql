DROP POLICY IF EXISTS "Profile photos are publicly readable" ON storage.objects;

CREATE POLICY "Profile photos respect visibility settings"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (
    (storage.foldername(name))[1] = 'broadcast'
    OR public.is_master_admin()
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
      AND (
        (storage.foldername(name))[1] = (auth.uid())::text
        OR (
          (storage.foldername(name))[2] = 'tribes'
          AND (storage.foldername(name))[3] ~ '^[0-9a-fA-F-]{36}$'
          AND public.is_chat_participant(((storage.foldername(name))[3])::uuid)
        )
        OR (storage.foldername(name))[2] = 'broadcasts'
        OR (
          (storage.foldername(name))[2] IS NULL
          AND public.can_view_profile_photo(((storage.foldername(name))[1])::uuid, auth.uid())
        )
      )
    )
  )
);