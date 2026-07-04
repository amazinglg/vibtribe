-- Restrict sensitive user_profiles columns so chat partners/contacts cannot
-- read them via the broad SELECT policies. Owner reads continue to work via
-- SECURITY DEFINER RPCs (get_my_full_profile, get_my_encryption_material,
-- get_my_totp_secret, get_my_totp_pending_secret) which run as the function
-- owner and are not subject to column-level grants.

REVOKE SELECT (totp_secret, totp_pending_secret, encrypted_private_key, key_iv, key_salt, mobile_hash, real_email)
  ON public.user_profiles FROM authenticated;

REVOKE SELECT (totp_secret, totp_pending_secret, encrypted_private_key, key_iv, key_salt, mobile_hash, real_email)
  ON public.user_profiles FROM anon;

-- service_role retains full access (used by server functions / admin ops).
GRANT SELECT ON public.user_profiles TO service_role;