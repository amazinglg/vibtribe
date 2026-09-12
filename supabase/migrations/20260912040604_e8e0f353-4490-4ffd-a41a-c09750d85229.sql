DROP POLICY IF EXISTS "users_select_related_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_select_chat_partner_profiles" ON public.user_profiles;

REVOKE EXECUTE ON FUNCTION public.get_public_profile_snippets(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile_snippets(uuid[]) TO authenticated;