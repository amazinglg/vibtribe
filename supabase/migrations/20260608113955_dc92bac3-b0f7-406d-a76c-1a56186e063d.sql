-- 1) Status media: drop public-read, require authenticated reader
DROP POLICY IF EXISTS "status_media_public_read" ON storage.objects;

CREATE POLICY "status_media_authenticated_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'status-media');

-- 2) Remove sensitive tables from realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='support_tickets') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.support_tickets';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='user_secure_chats') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.user_secure_chats';
  END IF;
END $$;