-- Restore realtime publication for tables the client subscribes to.
-- These were never added to supabase_realtime historically, so realtime
-- updates for notifications, secure-chat flags, support tickets and
-- force-release listener were silently disabled. Add them now.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_secure_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;

-- app_releases may not exist in all environments; guard the add.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='app_releases') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.app_releases';
  END IF;
END $$;
