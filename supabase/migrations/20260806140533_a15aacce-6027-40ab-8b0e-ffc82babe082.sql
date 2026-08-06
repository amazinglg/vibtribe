
CREATE OR REPLACE FUNCTION public._guard_direct_chat_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_other uuid;
BEGIN
  -- Service-role / trusted server paths (no JWT) are unaffected.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.participant_one IS DISTINCT FROM OLD.participant_one
       OR NEW.participant_two IS DISTINCT FROM OLD.participant_two
       OR COALESCE(NEW.is_group, false) IS DISTINCT FROM COALESCE(OLD.is_group, false) THEN
      RAISE EXCEPTION 'chat participants cannot be changed';
    END IF;
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_group, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.participant_one IS DISTINCT FROM v_uid
     AND NEW.participant_two IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'you must be a participant of the chat you create';
  END IF;

  v_other := CASE WHEN NEW.participant_one = v_uid THEN NEW.participant_two ELSE NEW.participant_one END;

  IF v_other IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_other = v_uid THEN
    RAISE EXCEPTION 'cannot start a chat with yourself';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = v_other
      AND COALESCE(p.is_suspended, false) = false
      AND COALESCE(p.account_status::text, 'active') IN ('active', 'pending_guardian')
  ) THEN
    RAISE EXCEPTION 'this account is not available';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocked_users b
    WHERE (b.blocker_id = v_other AND b.blocked_user_id = v_uid)
       OR (b.blocker_id = v_uid AND b.blocked_user_id = v_other)
  ) THEN
    RAISE EXCEPTION 'this account is not available';
  END IF;

  NEW.created_by := COALESCE(NEW.created_by, v_uid);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._guard_direct_chat_participants() FROM PUBLIC;

DROP TRIGGER IF EXISTS guard_direct_chat_participants ON public.chats;
CREATE TRIGGER guard_direct_chat_participants
BEFORE INSERT OR UPDATE ON public.chats
FOR EACH ROW EXECUTE FUNCTION public._guard_direct_chat_participants();
