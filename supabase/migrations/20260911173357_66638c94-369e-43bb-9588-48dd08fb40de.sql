DROP POLICY IF EXISTS members_insert_self_public_tribe ON public.chat_members;
CREATE POLICY members_insert_self_public_tribe
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'member'
  AND EXISTS (
    SELECT 1
    FROM public.chats c
    WHERE c.id = chat_members.chat_id
      AND c.is_group = true
      AND c.privacy = 'public'
  )
);

CREATE OR REPLACE FUNCTION public.guard_direct_chat_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.is_group, false) = false
     AND (NEW.participant_one IS DISTINCT FROM OLD.participant_one
       OR NEW.participant_two IS DISTINCT FROM OLD.participant_two) THEN
    RAISE EXCEPTION 'Direct chat participants cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_direct_chat_participants ON public.chats;
CREATE TRIGGER guard_direct_chat_participants
BEFORE UPDATE ON public.chats
FOR EACH ROW
EXECUTE FUNCTION public.guard_direct_chat_participants();

REVOKE ALL ON FUNCTION public.guard_direct_chat_participants() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_direct_chat_participants() TO service_role;