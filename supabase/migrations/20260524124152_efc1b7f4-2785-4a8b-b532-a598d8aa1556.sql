-- Restrict direct column access to dob so other users cannot read it via the
-- table. Owners read it through get_my_full_profile() (SECURITY DEFINER) and
-- admins through admin_get_user_profile / admin_list_user_profiles (also
-- SECURITY DEFINER, which run as the function owner and bypass column ACLs).
REVOKE SELECT (dob) ON public.user_profiles FROM anon, authenticated, PUBLIC;