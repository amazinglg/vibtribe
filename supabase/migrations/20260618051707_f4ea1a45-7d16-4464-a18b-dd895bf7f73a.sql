-- Fix: user_profiles full row exposure via permissive RLS policy.
-- RLS cannot restrict columns; use column-level grants instead.

DROP POLICY IF EXISTS users_view_other_profiles_public_columns ON public.user_profiles;

-- Cross-user SELECT policy (column-level grants below restrict which columns).
CREATE POLICY "authenticated_can_select_user_profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Reset table-level SELECT and grant only non-sensitive columns.
REVOKE SELECT ON public.user_profiles FROM anon, authenticated;

GRANT SELECT (
  id, email, full_name, mobile_number, username, bio, avatar_url, role,
  account_status, is_online, last_seen, profile_completed, public_key,
  created_at, updated_at, is_suspended, app_theme, country_code,
  is_master_admin, profile_photo_visibility, status_visibility,
  key_setup_completed, terms_accepted_at, dob,
  notif_messages, notif_status, notif_mentions, notif_sounds, notif_secure_chats,
  email_marketing_opt_in, marketing_consent_at, marketing_consent_source,
  pref_mic_enabled, pref_camera_enabled, pref_contacts_enabled, pref_notifications_enabled,
  is_verified, totp_enabled, totp_enabled_at
) ON public.user_profiles TO authenticated;

-- Sensitive columns (totp_secret, totp_pending_secret, encrypted_private_key,
-- key_salt, key_iv, real_email, marketing_consent_ip, login_attempts) are
-- NOT granted to authenticated/anon. Owners read them via SECURITY DEFINER
-- RPCs: get_my_full_profile, get_my_encryption_material, get_my_totp_secret,
-- get_my_totp_pending_secret. Server code uses service_role which retains
-- full privileges.

-- Preserve service_role full access (it already has ALL via earlier grants,
-- but re-assert defensively).
GRANT ALL ON public.user_profiles TO service_role;