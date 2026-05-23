
-- Part 1: encryption key columns
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS encrypted_private_key text,
  ADD COLUMN IF NOT EXISTS key_salt text,
  ADD COLUMN IF NOT EXISTS key_iv text,
  ADD COLUMN IF NOT EXISTS key_setup_completed boolean NOT NULL DEFAULT false;

-- Part 2: messages edit/delete columns
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_for_everyone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_for uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- Helper: delete-for-me (any participant can hide for themselves)
CREATE OR REPLACE FUNCTION public.delete_message_for_me(_msg_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _chat_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT chat_id INTO _chat_id FROM public.messages WHERE id = _msg_id;
  IF _chat_id IS NULL THEN RETURN; END IF;
  IF NOT public.is_chat_participant(_chat_id) THEN
    RAISE EXCEPTION 'Not a chat participant';
  END IF;
  UPDATE public.messages
    SET deleted_for = (
      SELECT ARRAY(SELECT DISTINCT unnest(coalesce(deleted_for, '{}'::uuid[]) || ARRAY[auth.uid()]))
    )
    WHERE id = _msg_id;
END;
$$;

-- Helper: delete-for-everyone (sender only, within 1 hour)
CREATE OR REPLACE FUNCTION public.delete_message_for_everyone(_msg_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender uuid;
  _created timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT sender_id, created_at INTO _sender, _created FROM public.messages WHERE id = _msg_id;
  IF _sender IS NULL THEN RETURN; END IF;
  IF _sender <> auth.uid() THEN
    RAISE EXCEPTION 'Only the sender can delete for everyone';
  END IF;
  IF _created < now() - interval '1 hour' THEN
    RAISE EXCEPTION 'Delete-for-everyone is only allowed within 1 hour of sending';
  END IF;
  UPDATE public.messages
    SET deleted_for_everyone = true,
        content = '__deleted_for_everyone__'
    WHERE id = _msg_id;
END;
$$;

-- Helper: edit message (sender only, within 15 minutes)
CREATE OR REPLACE FUNCTION public.edit_my_message(_msg_id uuid, _new_content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender uuid;
  _created timestamptz;
  _deleted boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT sender_id, created_at, deleted_for_everyone INTO _sender, _created, _deleted
    FROM public.messages WHERE id = _msg_id;
  IF _sender IS NULL THEN RETURN; END IF;
  IF _sender <> auth.uid() THEN
    RAISE EXCEPTION 'Only the sender can edit';
  END IF;
  IF _deleted THEN
    RAISE EXCEPTION 'Cannot edit a deleted message';
  END IF;
  IF length(coalesce(_new_content, '')) = 0 THEN
    RAISE EXCEPTION 'Content cannot be empty';
  END IF;
  UPDATE public.messages
    SET content = _new_content,
        edited_at = now()
    WHERE id = _msg_id;
END;
$$;
