DROP POLICY IF EXISTS trust_locks_update_owner ON public.trust_locks;
CREATE POLICY trust_locks_update_owner ON public.trust_locks
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (is_chat_participant(chat_id, auth.uid()) AND owner_user_id = auth.uid());