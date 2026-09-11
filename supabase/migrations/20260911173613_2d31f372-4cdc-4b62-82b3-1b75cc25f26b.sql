DROP TRIGGER IF EXISTS guard_direct_chat_participants ON public.chats;
DROP FUNCTION IF EXISTS public.guard_direct_chat_participants();

CREATE TRIGGER guard_direct_chat_participants
BEFORE UPDATE ON public.chats
FOR EACH ROW
EXECUTE FUNCTION public._guard_direct_chat_participants();