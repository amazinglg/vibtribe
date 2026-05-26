
-- 1. Tighten admin SELECT on chats/messages to master admin only
DROP POLICY IF EXISTS "admin_view_all_chats" ON public.chats;
CREATE POLICY "master_admin_view_all_chats" ON public.chats
  FOR SELECT TO authenticated
  USING (public.is_master_admin());

DROP POLICY IF EXISTS "admin_view_all_messages" ON public.messages;
CREATE POLICY "master_admin_view_all_messages" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_master_admin());

-- 2. Remove misleading notifications insert policy
-- (users can still self-insert via users_manage_own_notifications;
--  admins can still insert via admin policies on the table)
DROP POLICY IF EXISTS "admin_insert_notifications" ON public.notifications;

CREATE POLICY "admin_insert_any_notification" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- 3. Pin search_path on email-queue helpers
ALTER FUNCTION public.enqueue_email(text, jsonb)   SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint)   SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
