CREATE POLICY "Master admin can upload broadcast chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND public.is_master_admin()
);