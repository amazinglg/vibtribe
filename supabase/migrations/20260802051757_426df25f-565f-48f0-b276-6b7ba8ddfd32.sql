-- 1. messages.updated_at + trigger + delta index
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.messages_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_touch_updated_at ON public.messages;
CREATE TRIGGER trg_messages_touch_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.messages_touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_messages_chat_updated
  ON public.messages (chat_id, updated_at DESC);

-- 2. tombstones so clients can purge hard-deleted rows from the encrypted cache
CREATE TABLE IF NOT EXISTS public.message_tombstones (
  id uuid PRIMARY KEY,
  chat_id uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_tombstones_chat_deleted
  ON public.message_tombstones (chat_id, deleted_at DESC);

GRANT SELECT ON public.message_tombstones TO authenticated;
GRANT ALL ON public.message_tombstones TO service_role;

ALTER TABLE public.message_tombstones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read message tombstones" ON public.message_tombstones;
CREATE POLICY "Participants read message tombstones"
ON public.message_tombstones
FOR SELECT
TO authenticated
USING (public.is_chat_participant(chat_id));

CREATE OR REPLACE FUNCTION public.messages_write_tombstone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.chat_id IS NOT NULL THEN
    INSERT INTO public.message_tombstones (id, chat_id)
    VALUES (OLD.id, OLD.chat_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_write_tombstone ON public.messages;
CREATE TRIGGER trg_messages_write_tombstone
AFTER DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.messages_write_tombstone();

-- 3. user preferences for the offline cache
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS max_privacy_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS media_cache_limit_mb integer NOT NULL DEFAULT 250;