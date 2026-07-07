REVOKE EXECUTE ON FUNCTION public._profile_guard(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._my_profile_guard() FROM PUBLIC, anon, authenticated;