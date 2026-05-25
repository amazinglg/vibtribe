
-- 1) Notification preferences on user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS notif_messages      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_status        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_mentions      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_sounds        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_secure_chats  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_marketing_opt_in boolean NOT NULL DEFAULT true;

-- 2) OTP rate-limit support: mark attempts so admin can "reset"
ALTER TABLE public.email_otp_codes
  ADD COLUMN IF NOT EXISTS excluded_from_count boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_email_otp_codes_recent
  ON public.email_otp_codes (email, created_at DESC)
  WHERE excluded_from_count = false;

-- 3) Rate-limit check: returns remaining attempts (max 5 per rolling 24h)
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used integer;
BEGIN
  SELECT count(*) INTO used
    FROM public.email_otp_codes
   WHERE email = lower(trim(_email))
     AND excluded_from_count = false
     AND created_at > now() - interval '24 hours';
  RETURN GREATEST(0, 5 - used);
END;
$$;

-- 4) Update issue_email_otp to enforce the limit
CREATE OR REPLACE FUNCTION public.issue_email_otp(_email text, _code text, _purpose text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used integer;
BEGIN
  IF _purpose NOT IN ('signup','password_reset') THEN
    RAISE EXCEPTION 'Invalid OTP purpose';
  END IF;
  IF length(_code) <> 6 THEN
    RAISE EXCEPTION 'Code must be 6 digits';
  END IF;

  SELECT count(*) INTO used
    FROM public.email_otp_codes
   WHERE email = lower(trim(_email))
     AND excluded_from_count = false
     AND created_at > now() - interval '24 hours';
  IF used >= 5 THEN
    RAISE EXCEPTION 'OTP_RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  -- Mark prior unconsumed codes as consumed (single active code per email+purpose)
  UPDATE public.email_otp_codes
     SET consumed_at = now()
   WHERE email = lower(trim(_email))
     AND purpose = _purpose
     AND consumed_at IS NULL;

  INSERT INTO public.email_otp_codes (email, code_hash, purpose)
  VALUES (lower(trim(_email)), public._hash_otp(_code), _purpose);
END;
$$;

-- 5) Master-admin-only RPC to reset OTP resend attempts for a user
CREATE OR REPLACE FUNCTION public.admin_reset_otp_attempts(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _real_email text;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Only the master admin can reset OTP attempts';
  END IF;
  SELECT real_email INTO _real_email FROM public.user_profiles WHERE id = _user_id;
  IF _real_email IS NULL OR _real_email = '' THEN
    RAISE EXCEPTION 'No verified email on file for this account';
  END IF;
  UPDATE public.email_otp_codes
     SET excluded_from_count = true
   WHERE email = lower(_real_email)
     AND excluded_from_count = false;
END;
$$;

-- 6) Hide real_email from other users at the column level.
--    SECURITY DEFINER functions (get_my_full_profile, admin_get_user_profile,
--    pre_login_lookup, reset_password_with_otp) bypass this and still work.
REVOKE SELECT (real_email) ON public.user_profiles FROM PUBLIC;
REVOKE SELECT (real_email) ON public.user_profiles FROM anon;
REVOKE SELECT (real_email) ON public.user_profiles FROM authenticated;
