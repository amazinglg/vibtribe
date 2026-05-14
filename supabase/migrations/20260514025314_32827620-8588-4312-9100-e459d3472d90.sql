INSERT INTO storage.buckets (id, name, public)
VALUES ('status-media', 'status-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "status_media_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'status-media');

CREATE POLICY "status_media_user_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'status-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "status_media_user_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'status-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "status_media_user_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'status-media' AND auth.uid()::text = (storage.foldername(name))[1]);