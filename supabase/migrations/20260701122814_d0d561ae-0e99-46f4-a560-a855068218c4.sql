DROP POLICY IF EXISTS "Users update own chat media" ON storage.objects;
CREATE POLICY "Users update own chat media" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND (storage.foldername(name))[2] IS NOT NULL
    AND public.is_chat_participant(((storage.foldername(name))[2])::uuid)
  )
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND (storage.foldername(name))[2] IS NOT NULL
    AND public.is_chat_participant(((storage.foldername(name))[2])::uuid)
  );