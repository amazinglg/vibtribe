REVOKE ALL ON FUNCTION public._guard_direct_chat_participants() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._guard_direct_chat_participants() TO service_role;