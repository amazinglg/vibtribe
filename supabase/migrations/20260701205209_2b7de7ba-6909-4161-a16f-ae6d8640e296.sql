
-- 1. Extend user_status enum
ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'pending_guardian';

-- 2. Relax DOB trigger: block <13, allow 13+
CREATE OR REPLACE FUNCTION public.validate_user_dob()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.dob IS NOT NULL THEN
    IF NEW.dob > (CURRENT_DATE - INTERVAL '13 years')::date THEN
      RAISE EXCEPTION 'You must be at least 13 years old to use VibTribe';
    END IF;
    IF NEW.dob < '1900-01-01'::date THEN
      RAISE EXCEPTION 'Please enter a valid date of birth';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Guardian consents table
CREATE TABLE public.guardian_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guardian_name text NOT NULL,
  guardian_email text NOT NULL,
  guardian_mobile text NOT NULL,
  relationship text NOT NULL,
  consent_token text NOT NULL UNIQUE,
  email_otp_hash text,
  email_otp_expires_at timestamptz,
  email_otp_attempts int NOT NULL DEFAULT 0,
  email_verified_at timestamptz,
  consented_at timestamptz,
  revoked_at timestamptz,
  ip text,
  user_agent text,
  consent_version text NOT NULL DEFAULT '2026-06-18',
  last_reminder_sent_at timestamptz,
  graduated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guardian_consents_minor ON public.guardian_consents(minor_user_id);
CREATE INDEX idx_guardian_consents_token ON public.guardian_consents(consent_token);
CREATE INDEX idx_guardian_consents_active ON public.guardian_consents(minor_user_id) WHERE consented_at IS NOT NULL AND revoked_at IS NULL AND graduated_at IS NULL;

-- 4. GRANTs
GRANT SELECT, INSERT, UPDATE ON public.guardian_consents TO authenticated;
GRANT ALL ON public.guardian_consents TO service_role;

-- 5. RLS
ALTER TABLE public.guardian_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Minor can view own guardian consents"
  ON public.guardian_consents FOR SELECT
  TO authenticated
  USING (minor_user_id = auth.uid() OR public.is_admin_user());

CREATE POLICY "Admins can view all guardian consents"
  ON public.guardian_consents FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- Inserts / updates go through SECURITY DEFINER RPCs only
-- (no direct policies needed for INSERT/UPDATE from authenticated)

CREATE TRIGGER trg_guardian_consents_updated
  BEFORE UPDATE ON public.guardian_consents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- 6. Helper: has active guardian consent
CREATE OR REPLACE FUNCTION public.has_active_guardian_consent(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guardian_consents
    WHERE minor_user_id = _user_id
      AND consented_at IS NOT NULL
      AND revoked_at IS NULL
      AND graduated_at IS NULL
  );
$$;

-- 7. Age helper
CREATE OR REPLACE FUNCTION public.is_minor(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = _user_id
      AND dob IS NOT NULL
      AND dob > (CURRENT_DATE - INTERVAL '18 years')::date
  );
$$;

-- 8. Minor RPCs: submit guardian details / OTP
CREATE OR REPLACE FUNCTION public.submit_guardian_details(
  _guardian_name text,
  _guardian_email text,
  _guardian_mobile text,
  _relationship text
) RETURNS TABLE(consent_token text, otp_code text, guardian_email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public','extensions'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text;
  v_otp text;
  v_row public.guardian_consents;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_minor(v_uid) THEN
    RAISE EXCEPTION 'Guardian flow only applies to users under 18';
  END IF;
  IF _guardian_name IS NULL OR length(trim(_guardian_name)) < 2 THEN
    RAISE EXCEPTION 'Guardian name required';
  END IF;
  IF _guardian_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Valid guardian email required';
  END IF;
  IF _relationship NOT IN ('parent','mother','father','legal_guardian','grandparent','other') THEN
    RAISE EXCEPTION 'Invalid relationship';
  END IF;

  -- Reuse existing pending row if any, else create
  SELECT * INTO v_row FROM public.guardian_consents
    WHERE minor_user_id = v_uid
      AND revoked_at IS NULL
      AND graduated_at IS NULL
    ORDER BY created_at DESC LIMIT 1;

  v_otp := lpad((floor(random()*1000000))::int::text, 6, '0');

  IF v_row.id IS NULL THEN
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    INSERT INTO public.guardian_consents (
      minor_user_id, guardian_name, guardian_email, guardian_mobile,
      relationship, consent_token, email_otp_hash, email_otp_expires_at
    ) VALUES (
      v_uid, trim(_guardian_name), lower(trim(_guardian_email)), trim(_guardian_mobile),
      _relationship, v_token,
      extensions.crypt(v_otp, extensions.gen_salt('bf')),
      now() + interval '15 minutes'
    ) RETURNING * INTO v_row;
  ELSE
    UPDATE public.guardian_consents
      SET guardian_name = trim(_guardian_name),
          guardian_email = lower(trim(_guardian_email)),
          guardian_mobile = trim(_guardian_mobile),
          relationship = _relationship,
          email_otp_hash = extensions.crypt(v_otp, extensions.gen_salt('bf')),
          email_otp_expires_at = now() + interval '15 minutes',
          email_otp_attempts = 0,
          email_verified_at = NULL
      WHERE id = v_row.id
      RETURNING * INTO v_row;
  END IF;

  -- Set user status
  UPDATE public.user_profiles
    SET account_status = 'pending_guardian'::user_status
    WHERE id = v_uid AND account_status <> 'pending_guardian'::user_status;

  RETURN QUERY SELECT v_row.consent_token, v_otp, v_row.guardian_email;
END $$;

-- 9. Verify guardian email OTP (minor-side, to confirm before sending consent link)
CREATE OR REPLACE FUNCTION public.verify_guardian_email_otp(_code text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public','extensions'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.guardian_consents;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_row FROM public.guardian_consents
    WHERE minor_user_id = v_uid
      AND revoked_at IS NULL AND graduated_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'No pending guardian record'; END IF;
  IF v_row.email_otp_expires_at IS NULL OR v_row.email_otp_expires_at < now() THEN
    RAISE EXCEPTION 'OTP expired';
  END IF;
  IF v_row.email_otp_attempts >= 5 THEN
    RAISE EXCEPTION 'Too many attempts';
  END IF;
  UPDATE public.guardian_consents
    SET email_otp_attempts = email_otp_attempts + 1
    WHERE id = v_row.id;
  IF v_row.email_otp_hash IS NULL
     OR extensions.crypt(_code, v_row.email_otp_hash) <> v_row.email_otp_hash THEN
    RETURN false;
  END IF;
  UPDATE public.guardian_consents
    SET email_verified_at = now(),
        email_otp_hash = NULL,
        email_otp_expires_at = NULL
    WHERE id = v_row.id;
  RETURN true;
END $$;

-- 10. Public RPC: fetch consent record by token (for guardian page)
CREATE OR REPLACE FUNCTION public.get_guardian_consent_by_token(_token text)
RETURNS TABLE(
  id uuid, guardian_name text, guardian_email text, guardian_mobile text,
  relationship text, minor_full_name text, minor_dob date,
  consented_at timestamptz, revoked_at timestamptz, consent_version text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT gc.id, gc.guardian_name, gc.guardian_email, gc.guardian_mobile,
         gc.relationship, up.full_name AS minor_full_name, up.dob AS minor_dob,
         gc.consented_at, gc.revoked_at, gc.consent_version
    FROM public.guardian_consents gc
    JOIN public.user_profiles up ON up.id = gc.minor_user_id
    WHERE gc.consent_token = _token
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_guardian_consent_by_token(text) TO anon, authenticated;

-- 11. Public RPC: record consent (from guardian page)
CREATE OR REPLACE FUNCTION public.record_guardian_consent(_token text, _ip text, _user_agent text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_row public.guardian_consents;
BEGIN
  SELECT * INTO v_row FROM public.guardian_consents WHERE consent_token = _token;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Invalid token'; END IF;
  IF v_row.consented_at IS NOT NULL THEN RETURN true; END IF;
  IF v_row.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Consent was revoked'; END IF;

  UPDATE public.guardian_consents
    SET consented_at = now(), ip = _ip, user_agent = _user_agent
    WHERE id = v_row.id;
  -- Reactivate minor account
  UPDATE public.user_profiles
    SET account_status = 'active'::user_status
    WHERE id = v_row.minor_user_id;
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.record_guardian_consent(text, text, text) TO anon, authenticated;

-- 12. Public RPC: revoke consent (from monthly reminder link)
CREATE OR REPLACE FUNCTION public.revoke_guardian_consent(_token text, _ip text, _user_agent text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_row public.guardian_consents;
BEGIN
  SELECT * INTO v_row FROM public.guardian_consents WHERE consent_token = _token;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Invalid token'; END IF;
  UPDATE public.guardian_consents
    SET revoked_at = COALESCE(revoked_at, now()),
        ip = COALESCE(_ip, ip),
        user_agent = COALESCE(_user_agent, user_agent)
    WHERE id = v_row.id;
  UPDATE public.user_profiles
    SET account_status = 'pending_guardian'::user_status
    WHERE id = v_row.minor_user_id
      AND dob > (CURRENT_DATE - INTERVAL '18 years')::date;
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.revoke_guardian_consent(text, text, text) TO anon, authenticated;

-- 13. Admin RPC
CREATE OR REPLACE FUNCTION public.admin_get_guardian_consent(_user_id uuid)
RETURNS public.guardian_consents
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE r public.guardian_consents;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO r FROM public.guardian_consents
    WHERE minor_user_id = _user_id
    ORDER BY created_at DESC LIMIT 1;
  RETURN r;
END $$;

-- 14. Auto-graduation job (idempotent function; scheduled via pg_cron separately)
CREATE OR REPLACE FUNCTION public.guardian_auto_graduate()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_count int;
BEGIN
  WITH upd AS (
    UPDATE public.guardian_consents
      SET graduated_at = now()
      WHERE graduated_at IS NULL
        AND minor_user_id IN (
          SELECT id FROM public.user_profiles
          WHERE dob IS NOT NULL
            AND dob <= (CURRENT_DATE - INTERVAL '18 years')::date
        )
      RETURNING minor_user_id
  )
  SELECT COUNT(*) INTO v_count FROM upd;

  -- Lift pending_guardian for users who turned 18
  UPDATE public.user_profiles
    SET account_status = 'active'::user_status
    WHERE account_status = 'pending_guardian'::user_status
      AND dob IS NOT NULL
      AND dob <= (CURRENT_DATE - INTERVAL '18 years')::date;

  RETURN v_count;
END $$;
