
-- Disappear mode on chats
ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS disappear_mode text NOT NULL DEFAULT '24h'
    CHECK (disappear_mode IN ('never','24h','after_seen'));

-- Group chat support
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS created_by uuid;

-- Members table for groups
CREATE TABLE IF NOT EXISTS public.chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_chat_members_user ON public.chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat ON public.chat_members(chat_id);

-- Update is_chat_participant to include group members
CREATE OR REPLACE FUNCTION public.is_chat_participant(chat_uuid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chats
    WHERE id = chat_uuid AND (participant_one = auth.uid() OR participant_two = auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.chat_members WHERE chat_id = chat_uuid AND user_id = auth.uid()
  )
$$;

-- chat_members RLS
DROP POLICY IF EXISTS "members_select" ON public.chat_members;
CREATE POLICY "members_select" ON public.chat_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_participant(chat_id));

DROP POLICY IF EXISTS "members_insert" ON public.chat_members;
CREATE POLICY "members_insert" ON public.chat_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_chat_participant(chat_id));

DROP POLICY IF EXISTS "members_delete_self" ON public.chat_members;
CREATE POLICY "members_delete_self" ON public.chat_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Allow group members to view & update group chat metadata
DROP POLICY IF EXISTS "members_view_chats" ON public.chats;
CREATE POLICY "members_view_chats" ON public.chats
  FOR SELECT TO authenticated
  USING (public.is_chat_participant(id));

DROP POLICY IF EXISTS "creators_update_group_chats" ON public.chats;
CREATE POLICY "creators_update_group_chats" ON public.chats
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR participant_one = auth.uid() OR participant_two = auth.uid())
  WITH CHECK (created_by = auth.uid() OR participant_one = auth.uid() OR participant_two = auth.uid());

-- Allow authenticated users to create chats (groups need this)
DROP POLICY IF EXISTS "users_insert_chats" ON public.chats;
CREATE POLICY "users_insert_chats" ON public.chats
  FOR INSERT TO authenticated
  WITH CHECK (
    participant_one = auth.uid() OR participant_two = auth.uid() OR created_by = auth.uid()
  );

-- expires_at on messages + trigger
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_messages_expires_at
  ON public.messages(expires_at) WHERE expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_message_expiry()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE mode text;
BEGIN
  IF NEW.expires_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT disappear_mode INTO mode FROM public.chats WHERE id = NEW.chat_id;
  IF mode = '24h' THEN
    NEW.expires_at := now() + interval '24 hours';
  ELSIF mode = 'never' THEN
    NEW.expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_set_expiry ON public.messages;
CREATE TRIGGER messages_set_expiry
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_message_expiry();

-- RPC the app calls when leaving a chat in 'after_seen' mode
CREATE OR REPLACE FUNCTION public.expire_seen_messages(p_chat_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE mode text;
BEGIN
  IF NOT public.is_chat_participant(p_chat_id) THEN RETURN; END IF;
  SELECT disappear_mode INTO mode FROM public.chats WHERE id = p_chat_id;
  IF mode <> 'after_seen' THEN RETURN; END IF;
  UPDATE public.messages
    SET expires_at = now() + interval '30 seconds'
    WHERE chat_id = p_chat_id
      AND message_status = 'read'
      AND expires_at IS NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.expire_seen_messages(uuid) TO authenticated;

-- Background purge: delete expired messages every 5 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('purge-expired-messages');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-expired-messages',
  '*/5 * * * *',
  $$DELETE FROM public.messages WHERE expires_at IS NOT NULL AND expires_at < now()$$
);
