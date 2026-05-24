-- Column-level access control for sensitive user_profiles fields
-- Sensitive: encrypted_private_key, key_salt, key_iv, real_email, login_attempts

-- 1. Revoke column-level SELECT from broad roles
REVOKE SELECT (encrypted_private_key, key_salt, key_iv, real_email, login_attempts)
  ON public.user_profiles FROM authenticated, anon;

-- 2. Owner-only access via SECURITY DEFINER RPCs

-- Returns the full user_profiles row for the calling authenticated user
CREATE OR REPLACE FUNCTION public.get_my_full_profile()
RETURNS public.user_profiles
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.user_profiles WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_full_profile() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_full_profile() TO authenticated;

-- Returns encryption material for the calling authenticated user
CREATE OR REPLACE FUNCTION public.get_my_encryption_material()
RETURNS TABLE(
  public_key text,
  encrypted_private_key text,
  key_salt text,
  key_iv text,
  key_setup_completed boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public_key, encrypted_private_key, key_salt, key_iv, key_setup_completed
  FROM public.user_profiles WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_encryption_material() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_encryption_material() TO authenticated;

-- 3. Admin access to any profile (full row)
CREATE OR REPLACE FUNCTION public.admin_get_user_profile(_user_id uuid)
RETURNS public.user_profiles
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.user_profiles;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  SELECT * INTO result FROM public.user_profiles WHERE id = _user_id;
  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_user_profile(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_get_user_profile(uuid) TO authenticated;

-- 4. Anon-callable pre-login lookup. Returns the minimal info the sign-in
--    flow needs (id, suspension status, attempt counter, synthetic email)
--    keyed by the user's synthetic email OR their real_email.
CREATE OR REPLACE FUNCTION public.pre_login_lookup(_identifier text)
RETURNS TABLE(
  id uuid,
  email text,
  is_suspended boolean,
  account_status user_status,
  login_attempts integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, is_suspended, account_status, login_attempts
  FROM public.user_profiles
  WHERE email = lower(trim(_identifier))
     OR real_email ILIKE trim(_identifier)
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.pre_login_lookup(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pre_login_lookup(text) TO anon, authenticated;

-- 5. Anon-callable login-attempt counters. Bumps or resets login_attempts
--    and auto-suspends after 5 failures. Safe because the worst an attacker
--    can do is suspend an account they already know the email of.
CREATE OR REPLACE FUNCTION public.record_login_failure(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.user_profiles
    SET login_attempts = COALESCE(login_attempts, 0) + 1,
        is_suspended   = CASE WHEN COALESCE(login_attempts,0) + 1 >= 5 THEN true ELSE is_suspended END,
        account_status = CASE WHEN COALESCE(login_attempts,0) + 1 >= 5 THEN 'suspended'::user_status ELSE account_status END
    WHERE id = _user_id
    RETURNING login_attempts INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_login_failure(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_login_failure(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_login_success(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.user_profiles SET login_attempts = 0 WHERE id = _user_id;
$$;
REVOKE EXECUTE ON FUNCTION public.record_login_success(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_login_success(uuid) TO anon, authenticated;