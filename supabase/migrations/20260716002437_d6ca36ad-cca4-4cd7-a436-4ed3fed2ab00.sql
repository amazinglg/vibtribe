-- Prevent contacts and chat partners from reading sensitive authentication
-- and PII columns from user_profiles. RLS is row-level so the existing
-- related-profile SELECT policies leaked these columns; column-level
-- privilege revocation blocks them at the API layer.
-- Owner access continues through SECURITY DEFINER RPCs:
--   get_my_full_profile, get_my_encryption_material, get_my_totp_secret,
--   get_my_totp_pending_secret, get_my_saved_contact_profiles, admin_* RPCs.
-- Server code that legitimately needs these columns already uses supabaseAdmin
-- (service_role), whose grants are unaffected.
REVOKE SELECT (
  totp_secret,
  totp_pending_secret,
  encrypted_private_key,
  key_salt,
  key_iv,
  real_email,
  mobile_number,
  dob
) ON public.user_profiles FROM anon, authenticated;