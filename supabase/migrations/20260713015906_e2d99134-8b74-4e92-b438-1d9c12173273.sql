-- Restore EXECUTE on internal profile guard helpers to authenticated.
-- These functions are used by RLS policies and BEFORE UPDATE triggers on
-- public.user_profiles; without EXECUTE, ordinary users cannot update their
-- own profile row (e.g. setting up their 6-digit encryption PIN fails with
-- "permission denied for function _my_profile_guard").
GRANT EXECUTE ON FUNCTION public._profile_guard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._my_profile_guard() TO authenticated;