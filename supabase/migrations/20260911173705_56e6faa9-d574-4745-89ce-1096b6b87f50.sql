DROP TRIGGER IF EXISTS guard_direct_chat_participants ON public.chats;
CREATE TRIGGER guard_direct_chat_participants
BEFORE INSERT OR UPDATE ON public.chats
FOR EACH ROW
EXECUTE FUNCTION public._guard_direct_chat_participants();