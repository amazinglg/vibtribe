
CREATE TABLE public.user_hidden_chats (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chat_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_hidden_chats TO authenticated;
GRANT ALL ON public.user_hidden_chats TO service_role;

ALTER TABLE public.user_hidden_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user manages own hidden chats"
  ON public.user_hidden_chats
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_hidden_chats_user ON public.user_hidden_chats(user_id);
