-- Replace the overly-permissive ALL policy with per-command policies
DROP POLICY IF EXISTS users_manage_chat_messages ON public.messages;

CREATE POLICY messages_select_participants ON public.messages
  FOR SELECT
  USING (is_chat_participant(chat_id));

CREATE POLICY messages_insert_own ON public.messages
  FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND is_chat_participant(chat_id));

CREATE POLICY messages_update_own ON public.messages
  FOR UPDATE
  USING (sender_id = auth.uid() AND is_chat_participant(chat_id))
  WITH CHECK (sender_id = auth.uid() AND is_chat_participant(chat_id));

CREATE POLICY messages_delete_own ON public.messages
  FOR DELETE
  USING (
    sender_id = auth.uid()
    OR is_tribe_leader(chat_id, auth.uid())
    OR is_admin_user()
  );
