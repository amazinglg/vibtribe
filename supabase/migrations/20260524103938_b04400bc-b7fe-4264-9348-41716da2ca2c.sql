
-- Create chat-media bucket for encrypted media uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to their own folder (path: <userId>/...)
CREATE POLICY "Users upload own chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Anyone authenticated can read (content is end-to-end encrypted ciphertext)
CREATE POLICY "Authenticated read chat media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media');

-- Senders can delete their own uploads
CREATE POLICY "Users delete own chat media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
