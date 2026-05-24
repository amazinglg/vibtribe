
-- Drop the broad table-level SELECT and re-grant only safe columns.
REVOKE SELECT ON public.user_profiles FROM authenticated, anon;

GRANT SELECT (
  id, email, full_name, mobile_number, country_code, username, bio, avatar_url,
  role, account_status, is_suspended, is_master_admin, is_online, last_seen,
  status_visibility, profile_photo_visibility, app_theme, profile_completed,
  key_setup_completed, public_key, created_at, updated_at
) ON public.user_profiles TO authenticated;

GRANT SELECT (
  id, email, full_name, mobile_number, avatar_url
) ON public.user_profiles TO anon;

-- Admin-only full-list RPC (used by AdminPage user list).
CREATE OR REPLACE FUNCTION public.admin_list_user_profiles()
RETURNS SETOF public.user_profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY SELECT * FROM public.user_profiles ORDER BY created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_user_profiles() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_list_user_profiles() TO authenticated;
