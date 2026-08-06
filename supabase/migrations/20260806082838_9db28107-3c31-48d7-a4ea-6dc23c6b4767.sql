-- Replace blanket table-level UPDATE with column-scoped UPDATE that excludes mobile_verified_at.
REVOKE UPDATE ON public.user_profiles FROM authenticated;
REVOKE UPDATE ON public.user_profiles FROM anon;

GRANT UPDATE (
  id, email, full_name, mobile_number, username, bio, avatar_url, role, account_status,
  is_online, last_seen, profile_completed, public_key, created_at, updated_at, login_attempts,
  is_suspended, app_theme, real_email, country_code, is_master_admin, profile_photo_visibility,
  status_visibility, key_setup_completed, terms_accepted_at, dob, notif_messages, notif_status,
  notif_mentions, notif_sounds, notif_secure_chats, email_marketing_opt_in, marketing_consent_at,
  marketing_consent_ip, marketing_consent_source, pref_mic_enabled, pref_camera_enabled,
  pref_contacts_enabled, pref_notifications_enabled, is_verified, totp_enabled, totp_enabled_at,
  privacy_accepted_at, terms_warning_sent_at, mobile_hash, inactivity_warning_sent_at,
  inactivity_final_warning_sent_at, is_premium, premium_expires_at, premium_granted_at,
  premium_granted_by, premium_source, profile_photo_allowed_viewers, status_allowed_viewers,
  signup_reminders_sent, signup_reminder_last_sent_at, max_privacy_mode, media_cache_limit_mb
) ON public.user_profiles TO authenticated;

GRANT UPDATE (
  id, email, full_name, mobile_number, username, bio, avatar_url, role, account_status,
  is_online, last_seen, profile_completed, public_key, created_at, updated_at, login_attempts,
  is_suspended, app_theme, real_email, country_code, is_master_admin, profile_photo_visibility,
  status_visibility, key_setup_completed, terms_accepted_at, dob, notif_messages, notif_status,
  notif_mentions, notif_sounds, notif_secure_chats, email_marketing_opt_in, marketing_consent_at,
  marketing_consent_ip, marketing_consent_source, pref_mic_enabled, pref_camera_enabled,
  pref_contacts_enabled, pref_notifications_enabled, is_verified, totp_enabled, totp_enabled_at,
  privacy_accepted_at, terms_warning_sent_at, mobile_hash, inactivity_warning_sent_at,
  inactivity_final_warning_sent_at, is_premium, premium_expires_at, premium_granted_at,
  premium_granted_by, premium_source, profile_photo_allowed_viewers, status_allowed_viewers,
  signup_reminders_sent, signup_reminder_last_sent_at, max_privacy_mode, media_cache_limit_mb
) ON public.user_profiles TO anon;

-- service_role (used by the trusted SMS gateway path) keeps full UPDATE.
GRANT UPDATE ON public.user_profiles TO service_role;