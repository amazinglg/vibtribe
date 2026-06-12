
-- Tighten user_profiles SELECT: drop overly-broad RLS that exposed every column
-- to all authenticated users. Replace with column-level GRANTs so peers can
-- only read non-sensitive public columns. Owners continue to access full
-- profile via get_my_full_profile() SECURITY DEFINER RPC; admins via
-- admin_list_user_profiles() / admin_get_user_profile().

DROP POLICY IF EXISTS users_view_other_profiles_safe_columns ON public.user_profiles;

-- Recreate a clear peer-read policy. RLS still allows the row, but actual
-- column visibility is enforced by GRANT below.
CREATE POLICY users_view_other_profiles_public_columns
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Reset privileges and grant only safe public columns to authenticated.
REVOKE SELECT ON public.user_profiles FROM authenticated;
REVOKE SELECT ON public.user_profiles FROM anon;

GRANT SELECT (
  id,
  full_name,
  mobile_number,
  username,
  bio,
  avatar_url,
  role,
  is_online,
  last_seen,
  profile_completed,
  public_key,
  created_at,
  updated_at,
  country_code,
  profile_photo_visibility,
  status_visibility,
  terms_accepted_at,
  key_setup_completed
) ON public.user_profiles TO authenticated;

-- Owners write their own row (column writes still validated by existing
-- users_update_own_profile_safe policy). UPDATE/INSERT/DELETE do not need
-- SELECT grants.
GRANT INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;

-- Service role keeps full access for server functions.
GRANT ALL ON public.user_profiles TO service_role;
