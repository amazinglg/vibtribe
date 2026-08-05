-- ============ Private schema for SMS verification infrastructure ============
CREATE SCHEMA IF NOT EXISTS sms_gw;

REVOKE ALL ON SCHEMA sms_gw FROM PUBLIC;
REVOKE ALL ON SCHEMA sms_gw FROM anon, authenticated;
GRANT USAGE ON SCHEMA sms_gw TO service_role;

-- ---------------- pending verification claims ----------------
CREATE TABLE IF NOT EXISTS sms_gw.phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mobile_hash text NOT NULL,
  country_code text,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  gateway_id text NOT NULL DEFAULT 'gw_primary',
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  consumed_sms_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS phone_verifications_token_hash_key
  ON sms_gw.phone_verifications (token_hash);
CREATE INDEX IF NOT EXISTS phone_verifications_user_idx
  ON sms_gw.phone_verifications (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS phone_verifications_one_pending
  ON sms_gw.phone_verifications (user_id)
  WHERE status = 'pending';

ALTER TABLE sms_gw.phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_gw.phone_verifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON sms_gw.phone_verifications FROM PUBLIC, anon, authenticated;

-- ---------------- gateway event log (idempotency) ----------------
CREATE TABLE IF NOT EXISTS sms_gw.sms_gateway_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id text NOT NULL,
  sms_id text NOT NULL,
  token_fingerprint text,
  verification_id uuid REFERENCES sms_gw.phone_verifications(id) ON DELETE SET NULL,
  outcome text NOT NULL,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sms_gateway_events_sms_id_key
  ON sms_gw.sms_gateway_events (gateway_id, sms_id);

ALTER TABLE sms_gw.sms_gateway_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_gw.sms_gateway_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON sms_gw.sms_gateway_events FROM PUBLIC, anon, authenticated;

-- ---------------- nonce replay protection ----------------
CREATE TABLE IF NOT EXISTS sms_gw.gateway_nonces (
  gateway_id text NOT NULL,
  nonce text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gateway_id, nonce)
);
ALTER TABLE sms_gw.gateway_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_gw.gateway_nonces FORCE ROW LEVEL SECURITY;
REVOKE ALL ON sms_gw.gateway_nonces FROM PUBLIC, anon, authenticated;

-- ---------------- user_profiles additive column ----------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS mobile_verified_at timestamptz;

GRANT SELECT (mobile_verified_at) ON public.user_profiles TO authenticated;

-- ============================ functions ============================

-- Create (or reuse) a pending verification claim. Server-only.
CREATE OR REPLACE FUNCTION sms_gw.create_phone_claim(
  _user_id uuid,
  _token_hash text,
  _gateway_id text DEFAULT 'gw_primary'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sms_gw, public
AS $$
DECLARE
  v_mobile text;
  v_cc text;
  v_hash text;
  v_recent integer;
  v_id uuid;
BEGIN
  SELECT mobile_number, country_code, mobile_hash
    INTO v_mobile, v_cc, v_hash
    FROM public.user_profiles WHERE id = _user_id;

  IF v_mobile IS NULL OR v_mobile = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_mobile_on_profile');
  END IF;

  IF v_hash IS NULL THEN
    v_hash := public.compute_mobile_hash(v_mobile);
  END IF;
  IF v_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_mobile');
  END IF;

  -- rate limit: max 5 claims per user per hour
  SELECT count(*) INTO v_recent
    FROM sms_gw.phone_verifications
   WHERE user_id = _user_id AND created_at > now() - interval '1 hour';
  IF v_recent >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  -- expire stale pendings, then supersede any live pending for this user
  UPDATE sms_gw.phone_verifications
     SET status = 'expired', updated_at = now()
   WHERE status = 'pending' AND expires_at < now();

  UPDATE sms_gw.phone_verifications
     SET status = 'superseded', updated_at = now()
   WHERE user_id = _user_id AND status = 'pending';

  INSERT INTO sms_gw.phone_verifications
    (user_id, mobile_hash, country_code, token_hash, gateway_id, expires_at)
  VALUES
    (_user_id, v_hash, v_cc, _token_hash, _gateway_id, now() + interval '10 minutes')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'verification_id', v_id,
    'expires_at', (now() + interval '10 minutes')
  );
END;
$$;

-- Consume a token submitted by the SMS gateway. Server-only.
CREATE OR REPLACE FUNCTION sms_gw.consume_gateway_token(
  _gateway_id text,
  _sms_id text,
  _token_hash text,
  _token_fingerprint text,
  _from_msisdn text,
  _received_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sms_gw, public
AS $$
DECLARE
  v_prior sms_gw.sms_gateway_events%ROWTYPE;
  v_claim sms_gw.phone_verifications%ROWTYPE;
  v_from_hash text;
  v_outcome text;
BEGIN
  -- idempotency: same (gateway, sms_id) returns the original outcome
  SELECT * INTO v_prior FROM sms_gw.sms_gateway_events
   WHERE gateway_id = _gateway_id AND sms_id = _sms_id;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', v_prior.outcome = 'verified',
                              'outcome', v_prior.outcome, 'duplicate', true);
  END IF;

  v_from_hash := public.compute_mobile_hash(_from_msisdn);

  SELECT * INTO v_claim FROM sms_gw.phone_verifications
   WHERE token_hash = _token_hash
   FOR UPDATE;

  IF NOT FOUND THEN
    v_outcome := 'unknown_token';
  ELSIF v_claim.status = 'verified' THEN
    v_outcome := 'already_verified';
  ELSIF v_claim.status <> 'pending' THEN
    v_outcome := 'claim_' || v_claim.status;
  ELSIF v_claim.expires_at < now() THEN
    UPDATE sms_gw.phone_verifications SET status = 'expired', updated_at = now()
     WHERE id = v_claim.id;
    v_outcome := 'expired';
  ELSIF v_from_hash IS NULL OR v_from_hash <> v_claim.mobile_hash THEN
    UPDATE sms_gw.phone_verifications
       SET attempts = attempts + 1, updated_at = now()
     WHERE id = v_claim.id;
    v_outcome := 'sender_mismatch';
  ELSE
    UPDATE sms_gw.phone_verifications
       SET status = 'verified', verified_at = now(),
           consumed_sms_id = _sms_id, updated_at = now()
     WHERE id = v_claim.id;
    UPDATE public.user_profiles
       SET mobile_verified_at = now()
     WHERE id = v_claim.user_id;
    v_outcome := 'verified';
  END IF;

  INSERT INTO sms_gw.sms_gateway_events
    (gateway_id, sms_id, token_fingerprint, verification_id, outcome, received_at)
  VALUES
    (_gateway_id, _sms_id, _token_fingerprint,
     CASE WHEN v_claim.id IS NOT NULL THEN v_claim.id END,
     v_outcome, _received_at);

  RETURN jsonb_build_object('ok', v_outcome = 'verified',
                            'outcome', v_outcome, 'duplicate', false);
END;
$$;

-- Nonce registration (replay protection). Returns false if already seen.
CREATE OR REPLACE FUNCTION sms_gw.register_gateway_nonce(
  _gateway_id text, _nonce text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sms_gw, public
AS $$
BEGIN
  DELETE FROM sms_gw.gateway_nonces WHERE seen_at < now() - interval '1 hour';
  INSERT INTO sms_gw.gateway_nonces (gateway_id, nonce) VALUES (_gateway_id, _nonce);
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;
END;
$$;

-- Status read for the owning user (server calls it with the verified user id).
CREATE OR REPLACE FUNCTION sms_gw.get_phone_status(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = sms_gw, public
AS $$
  SELECT jsonb_build_object(
    'verified', (SELECT mobile_verified_at IS NOT NULL FROM public.user_profiles WHERE id = _user_id),
    'pending_expires_at', (SELECT expires_at FROM sms_gw.phone_verifications
                            WHERE user_id = _user_id AND status = 'pending'
                              AND expires_at > now() LIMIT 1)
  );
$$;

REVOKE ALL ON FUNCTION sms_gw.create_phone_claim(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sms_gw.consume_gateway_token(text, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sms_gw.register_gateway_nonce(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sms_gw.get_phone_status(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION sms_gw.create_phone_claim(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION sms_gw.consume_gateway_token(text, text, text, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION sms_gw.register_gateway_nonce(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION sms_gw.get_phone_status(uuid) TO service_role;