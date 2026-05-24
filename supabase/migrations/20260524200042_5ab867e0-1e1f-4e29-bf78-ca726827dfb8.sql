
-- Per-user secure chat marking. Each user independently decides which chats
-- are secure and what code unlocks them.
CREATE TABLE IF NOT EXISTS public.user_secure_chats (
  user_id uuid NOT NULL,
  chat_id uuid NOT NULL,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chat_id)
);

ALTER TABLE public.user_secure_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_secure_marks"
  ON public.user_secure_chats
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_secure_chats_user ON public.user_secure_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_secure_chats_code ON public.user_secure_chats(user_id, code);

-- Mark each outgoing message with whether sender considered the chat secure
-- at send-time. Receivers use this to show the privacy badge on the message.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sent_secure boolean NOT NULL DEFAULT false;

-- Migrate existing chat-level secure flags into per-user marks for BOTH participants
-- (preserves current behavior for existing secured chats), then convert chats back
-- to normal so the new per-user filter is the source of truth.
INSERT INTO public.user_secure_chats (user_id, chat_id, code)
SELECT c.participant_one, c.id, COALESCE(c.secure_code, '0000')
  FROM public.chats c
 WHERE c.chat_type = 'secure' AND c.participant_one IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_secure_chats (user_id, chat_id, code)
SELECT c.participant_two, c.id, COALESCE(c.secure_code, '0000')
  FROM public.chats c
 WHERE c.chat_type = 'secure' AND c.participant_two IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE public.chats SET chat_type = 'normal' WHERE chat_type = 'secure';
