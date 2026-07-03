-- 1) Revoke direct SELECT on sensitive columns from authenticated.
--    Owner and admin already read these via SECURITY DEFINER RPCs:
--    totp_secret          -> get_my_totp_secret() / admin_get_totp_secret_by_identifier() / auth-login server route (service role)
--    totp_pending_secret  -> get_my_totp_pending_secret()
--    encrypted_private_key/key_salt/key_iv -> get_my_encryption_material()
--    marketing_consent_ip -> admin_get_user_profile() (SECURITY DEFINER)
--    UPDATE grants stay intact so owner can rotate keys / accept marketing.
REVOKE SELECT (
  totp_secret,
  totp_pending_secret,
  encrypted_private_key,
  key_salt,
  key_iv,
  marketing_consent_ip
) ON public.user_profiles FROM authenticated;

-- Explicit re-grant of the remaining columns is not required: REVOKE on
-- specific columns only removes those columns from the role's SELECT set;
-- everything else stays selectable per existing GRANT SELECT ON TABLE.

-- 2) Rate limit primitive shared across sensitive endpoints.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, window_start)
);

GRANT ALL ON public.rate_limits TO service_role;
-- authenticated has no direct grants; only reached via SECURITY DEFINER RPC below.

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS rate_limits_expires_at_idx
  ON public.rate_limits (expires_at);

-- Atomic bucket-window limiter. Returns true if the request is allowed,
-- false if the caller has exceeded _max hits inside _window_secs.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  _key text,
  _max integer,
  _window_secs integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket timestamptz;
  v_expires timestamptz;
  v_count integer;
BEGIN
  IF _key IS NULL OR length(_key) = 0 THEN
    RAISE EXCEPTION 'rate_limit_hit: key required';
  END IF;
  IF _max <= 0 OR _window_secs <= 0 THEN
    RAISE EXCEPTION 'rate_limit_hit: max/window must be > 0';
  END IF;

  v_bucket  := date_trunc('second', now())
               - (extract(epoch FROM now())::bigint % _window_secs) * interval '1 second';
  v_expires := v_bucket + (_window_secs * interval '1 second');

  INSERT INTO public.rate_limits (key, window_start, count, expires_at)
  VALUES (_key, v_bucket, 1, v_expires)
  ON CONFLICT (key, window_start)
    DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= _max;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO authenticated, anon, service_role;

-- Housekeeping: drop expired buckets hourly so the table stays tiny.
CREATE OR REPLACE FUNCTION public.rate_limits_cleanup()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE expires_at < now() - interval '1 hour';
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('rate-limits-cleanup');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'rate-limits-cleanup',
  '17 * * * *',
  $$SELECT public.rate_limits_cleanup();$$
);