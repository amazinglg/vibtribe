-- Allow master admin to upload/update broadcast avatar files in profile-photos bucket
-- (path prefix 'broadcast/' is reserved for the official VibTribe avatar).
CREATE POLICY "Master admin can upload broadcast avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = 'broadcast'
    AND public.is_master_admin()
  );

CREATE POLICY "Master admin can update broadcast avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = 'broadcast'
    AND public.is_master_admin()
  );

CREATE POLICY "Master admin can delete broadcast avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = 'broadcast'
    AND public.is_master_admin()
  );