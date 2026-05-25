
-- OTP codes table
CREATE TABLE IF NOT EXISTS public.email_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('signup','password_reset')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_otp_codes_email_purpose_idx
  ON public.email_otp_codes (email, purpose, created_at DESC);

ALTER TABLE public.email_otp_codes ENABLE ROW LEVEL SECURITY;

-- No direct policies — all access via SECURITY DEFINER RPCs only.
CREATE POLICY "Service role only" ON public.email_otp_codes
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Helper: hash code with sha256
CREATE OR REPLACE FUNCTION public._hash_otp(_code text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=public,extensions AS $$
  SELECT encode(extensions.digest(_code, 'sha256'), 'hex')
$$;

-- Issue a new OTP code; invalidates any prior unconsumed ones for same email+purpose
CREATE OR REPLACE FUNCTION public.issue_email_otp(_email text, _code text, _purpose text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _purpose NOT IN ('signup','password_reset') THEN
    RAISE EXCEPTION 'Invalid OTP purpose';
  END IF;
  IF length(_code) <> 6 THEN
    RAISE EXCEPTION 'Code must be 6 digits';
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

-- Verify an OTP. Returns true if valid; marks consumed on success.
CREATE OR REPLACE FUNCTION public.consume_email_otp(_email text, _code text, _purpose text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  rec record;
BEGIN
  SELECT * INTO rec FROM public.email_otp_codes
   WHERE email = lower(trim(_email))
     AND purpose = _purpose
     AND consumed_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1;

  IF rec.id IS NULL THEN
    RETURN false;
  END IF;

  IF rec.expires_at < now() THEN
    UPDATE public.email_otp_codes SET consumed_at = now() WHERE id = rec.id;
    RETURN false;
  END IF;

  IF rec.attempts >= 5 THEN
    UPDATE public.email_otp_codes SET consumed_at = now() WHERE id = rec.id;
    RETURN false;
  END IF;

  IF rec.code_hash <> public._hash_otp(_code) THEN
    UPDATE public.email_otp_codes SET attempts = attempts + 1 WHERE id = rec.id;
    RETURN false;
  END IF;

  UPDATE public.email_otp_codes SET consumed_at = now() WHERE id = rec.id;
  RETURN true;
END;
$$;

-- Reset password using an OTP. Identifier may be email, real_email, or mobile.
CREATE OR REPLACE FUNCTION public.reset_password_with_otp(
  _identifier text, _code text, _new_password text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE
  _profile record;
  _otp_email text;
BEGIN
  IF length(_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- Find user. Identifier may be real_email, synthetic auth email, or mobile.
  SELECT id, email, real_email INTO _profile
    FROM public.user_profiles
   WHERE lower(real_email) = lower(trim(_identifier))
      OR lower(email)      = lower(trim(_identifier))
      OR mobile_number     = trim(_identifier)
      OR mobile_number     LIKE '%' || regexp_replace(trim(_identifier), '\D', '', 'g')
   LIMIT 1;

  IF _profile.id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  _otp_email := lower(coalesce(_profile.real_email, ''));
  IF _otp_email = '' THEN
    RAISE EXCEPTION 'No verified email on file for this account';
  END IF;

  IF NOT public.consume_email_otp(_otp_email, _code, 'password_reset') THEN
    RAISE EXCEPTION 'Invalid or expired code';
  END IF;

  UPDATE auth.users
     SET encrypted_password = extensions.crypt(_new_password, extensions.gen_salt('bf')),
         updated_at = now()
   WHERE id = _profile.id;

  UPDATE public.user_profiles
     SET login_attempts = 0,
         is_suspended = false,
         account_status = 'active'::user_status
   WHERE id = _profile.id;
END;
$$;

-- Lookup whether a real_email is already used by another account
CREATE OR REPLACE FUNCTION public.is_real_email_available(_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE lower(real_email) = lower(trim(_email))
  );
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.issue_email_otp(text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_email_otp(text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_password_with_otp(text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_real_email_available(text) TO anon, authenticated;
