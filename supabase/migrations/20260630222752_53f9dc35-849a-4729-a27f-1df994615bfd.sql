
-- Phase 2/3: secured chats — unmark with keep/delete, and tribe-wide secure marking

-- Helper: am I admin/leader of this tribe?
CREATE OR REPLACE FUNCTION public.is_tribe_admin(_chat_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1
      FROM public.chat_members cm
     WHERE cm.chat_id = _chat_id
       AND cm.user_id = _user_id
       AND cm.role = 'leader'
  )
  OR EXISTS(
    SELECT 1 FROM public.chats c
     WHERE c.id = _chat_id AND c.created_by = _user_id
  );
$$;

-- Unmark a secured chat for the caller.
-- _delete_messages:
--   false → just remove the per-user secure mark; chat + messages stay intact
--           (other participant and other tribe members unaffected; chat
--           visibility / auto-delete setting is NOT touched).
--   true  → 1:1 chat: delete the chat entirely (cascades messages + members);
--           group chat: remove the caller from chat_members (they leave the
--           tribe). For groups we never delete shared history.
CREATE OR REPLACE FUNCTION public.unmark_secure_chat(_chat_id uuid, _delete_messages boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_group boolean;
  v_had_mark boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Caller must have actually secured this chat
  SELECT EXISTS(
    SELECT 1 FROM public.user_secure_chats
    WHERE user_id = v_caller AND chat_id = _chat_id
  ) INTO v_had_mark;
  IF NOT v_had_mark THEN
    RAISE EXCEPTION 'This chat is not in your Secure Vault';
  END IF;

  SELECT is_group INTO v_is_group FROM public.chats WHERE id = _chat_id;

  -- Always drop the caller's secure mark
  DELETE FROM public.user_secure_chats
   WHERE user_id = v_caller AND chat_id = _chat_id;

  IF _delete_messages THEN
    IF COALESCE(v_is_group, false) THEN
      -- Leave the tribe; shared history stays for other members
      DELETE FROM public.chat_members
        WHERE chat_id = _chat_id AND user_id = v_caller;
    ELSE
      -- 1:1 chat: full purge for both sides (cascades messages + members)
      DELETE FROM public.chats WHERE id = _chat_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'chat_id', _chat_id,
    'is_group', COALESCE(v_is_group, false),
    'deleted', _delete_messages
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unmark_secure_chat(uuid, boolean) TO authenticated;

-- Mark an entire tribe as secured by the leader/admin.
-- Inserts a per-member row in user_secure_chats hashing the SAME plaintext
-- code separately for each member (bcrypt salts differ but every member's
-- find_secure_chat_by_code(code) call resolves to this chat).
CREATE OR REPLACE FUNCTION public.mark_secure_tribe(_chat_id uuid, _code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_group boolean;
  v_count int := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _code IS NULL OR length(trim(_code)) < 4 THEN
    RAISE EXCEPTION 'Unlock code must be at least 4 characters';
  END IF;

  SELECT is_group INTO v_is_group FROM public.chats WHERE id = _chat_id;
  IF NOT COALESCE(v_is_group, false) THEN
    RAISE EXCEPTION 'This is not a tribe';
  END IF;
  IF NOT public.is_tribe_admin(_chat_id, v_caller) THEN
    RAISE EXCEPTION 'Only the tribe leader can secure a tribe';
  END IF;

  -- Hash the same plaintext code per-member (bcrypt with its own salt)
  WITH ins AS (
    INSERT INTO public.user_secure_chats (user_id, chat_id, code_hash)
    SELECT cm.user_id, _chat_id, extensions.crypt(_code, extensions.gen_salt('bf'))
      FROM public.chat_members cm
     WHERE cm.chat_id = _chat_id
    ON CONFLICT (user_id, chat_id) DO UPDATE SET code_hash = EXCLUDED.code_hash
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;

  RETURN jsonb_build_object('chat_id', _chat_id, 'members_secured', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_secure_tribe(uuid, text) TO authenticated;

-- Helper: is this tribe currently secured for any member? Used by clients
-- only to decide UI state (don't show "Secure tribe" button if already
-- secured). RLS-safe — counts across user_secure_chats via SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.is_tribe_secured(_chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_secure_chats
     WHERE chat_id = _chat_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tribe_secured(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tribe_admin(uuid, uuid) TO authenticated;
