
CREATE TABLE IF NOT EXISTS public.user_active_chat (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_active_chat TO authenticated;
GRANT ALL ON public.user_active_chat TO service_role;
ALTER TABLE public.user_active_chat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own active chat manage" ON public.user_active_chat;
CREATE POLICY "own active chat manage" ON public.user_active_chat
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
