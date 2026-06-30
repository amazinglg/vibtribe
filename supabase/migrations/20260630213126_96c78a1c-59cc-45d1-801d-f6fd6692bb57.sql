
-- Phase B + C: DPDP - Consent Center, Data Export, Hashed Contact Sync

-- =============================================================
-- 1. user_consents (per-purpose granular consent state)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  source text,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, purpose)
);

GRANT SELECT, INSERT, UPDATE ON public.user_consents TO authenticated;
GRANT ALL ON public.user_consents TO service_role;

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own consents"
  ON public.user_consents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Writes only via SECURITY DEFINER RPC below
CREATE POLICY "Users insert own consents"
  ON public.user_consents FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own consents"
  ON public.user_consents FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_user_consent(
  _purpose text,
  _granted boolean,
  _source text DEFAULT 'consent_center'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_allowed text[] := ARRAY[
    'contacts_matching',
    'photo_visibility_public',
    'last_seen_visible',
    'marketing_email',
    'marketing_push',
    'marketing_sms',
    'analytics',
    'notification_messages',
    'notification_calls',
    'notification_tribes',
    'notification_status'
  ];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (_purpose = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'unknown consent purpose: %', _purpose;
  END IF;

  INSERT INTO public.user_consents (user_id, purpose, granted, source, granted_at, withdrawn_at)
  VALUES (
    v_user, _purpose, _granted, _source,
    CASE WHEN _granted THEN now() ELSE NULL END,
    CASE WHEN _granted THEN NULL ELSE now() END
  )
  ON CONFLICT (user_id, purpose) DO UPDATE
  SET granted = EXCLUDED.granted,
      source  = COALESCE(EXCLUDED.source, public.user_consents.source),
      granted_at = CASE WHEN EXCLUDED.granted THEN now() ELSE public.user_consents.granted_at END,
      withdrawn_at = CASE WHEN EXCLUDED.granted THEN NULL ELSE now() END,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_consent(text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_consent(text, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_user_consents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_user_consents_updated_at ON public.user_consents;
CREATE TRIGGER trg_user_consents_updated_at
  BEFORE UPDATE ON public.user_consents
  FOR EACH ROW EXECUTE FUNCTION public.update_user_consents_updated_at();

-- =============================================================
-- 2. data_export_requests (Download My Data, rate-limited 1/30d)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  delivered_to_email text,
  byte_size integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS data_export_requests_user_idx
  ON public.data_export_requests(user_id, created_at DESC);

GRANT SELECT ON public.data_export_requests TO authenticated;
GRANT ALL ON public.data_export_requests TO service_role;

ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own export requests"
  ON public.data_export_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================
-- 3. Hashed contact sync: mobile_hash on user_profiles
--    Pepper is a non-secret constant (public salt) — mirrored in client code.
-- =============================================================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS mobile_hash text;

CREATE INDEX IF NOT EXISTS user_profiles_mobile_hash_idx
  ON public.user_profiles(mobile_hash);

CREATE OR REPLACE FUNCTION public.compute_mobile_hash(_mobile text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits text;
  v_last10 text;
BEGIN
  IF _mobile IS NULL OR _mobile = '' THEN RETURN NULL; END IF;
  v_digits := regexp_replace(_mobile, '\D', '', 'g');
  IF length(v_digits) < 7 THEN RETURN NULL; END IF;
  v_last10 := right(v_digits, 10);
  RETURN encode(
    digest(('vibtribe_v1_contact_pepper:' || v_last10)::bytea, 'sha256'),
    'hex'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_profiles_set_mobile_hash()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.mobile_hash := public.compute_mobile_hash(NEW.mobile_number);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_user_profiles_mobile_hash ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_mobile_hash
  BEFORE INSERT OR UPDATE OF mobile_number ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_set_mobile_hash();

-- Backfill existing rows (one-time)
UPDATE public.user_profiles
  SET mobile_hash = public.compute_mobile_hash(mobile_number)
WHERE mobile_number IS NOT NULL AND mobile_hash IS NULL;

-- =============================================================
-- 4. RPC: find users by precomputed mobile hashes
-- =============================================================
CREATE OR REPLACE FUNCTION public.find_users_by_mobile_hashes(_hashes text[])
RETURNS TABLE (
  id uuid,
  full_name text,
  mobile_hash text,
  avatar_url text,
  profile_photo_visibility text,
  is_verified boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF _hashes IS NULL OR array_length(_hashes, 1) IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT up.id, up.full_name, up.mobile_hash,
           up.avatar_url, up.profile_photo_visibility, up.is_verified
      FROM public.user_profiles up
     WHERE up.id <> auth.uid()
       AND up.mobile_hash = ANY(_hashes)
     LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.find_users_by_mobile_hashes(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_users_by_mobile_hashes(text[]) TO authenticated;
