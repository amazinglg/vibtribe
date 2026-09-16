ALTER POLICY messages_insert_own ON public.messages TO authenticated;
ALTER POLICY messages_select_participants ON public.messages TO authenticated;
ALTER POLICY messages_update_own ON public.messages TO authenticated;
ALTER POLICY trust_locks_update_owner ON public.trust_locks TO authenticated;

REVOKE ALL ON FUNCTION public.is_chat_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_chat_participant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.is_chat_participant(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_chat_participant(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(uuid, uuid) TO service_role;