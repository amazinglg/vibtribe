
-- Lock down email columns: only the owner, admins, or master admin can read them.
-- Other authenticated users can still read non-email columns (full_name, avatar, etc.)
-- via the existing "users_view_all_profiles" policy.
-- The SECURITY DEFINER RPCs (get_my_full_profile, admin_get_user_profile,
-- admin_list_user_profiles) bypass these column grants and continue to work.

REVOKE SELECT (email, real_email) ON public.user_profiles FROM authenticated;
REVOKE SELECT (email, real_email) ON public.user_profiles FROM anon;

-- service_role still has ALL — keep that intact (server fns / queue worker rely on it).
GRANT SELECT (email, real_email) ON public.user_profiles TO service_role;
