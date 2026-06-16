
-- 1. Verified flag on user_profiles (admin-managed; default false; persists until admin toggles)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- 2. TOTP 2FA fields on user_profiles (stored secret is a base32 string;
--    pending = during enrollment, only promoted on first successful verification)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS totp_secret text,
  ADD COLUMN IF NOT EXISTS totp_pending_secret text,
  ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz;

-- 3. Auto-verify the pinned master admin (VibTribe Official broadcast)
UPDATE public.user_profiles
   SET is_verified = true
 WHERE public.is_pinned_master_mobile(mobile_number);

-- 4. App-wide settings (key/value) — used for broadcast avatar override
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings public read" ON public.app_settings;
CREATE POLICY "app_settings public read"
  ON public.app_settings FOR SELECT
  USING (true);

-- 5. RPC: admin/master toggles user verified flag
CREATE OR REPLACE FUNCTION public.admin_set_user_verified(_user_id uuid, _verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  UPDATE public.user_profiles SET is_verified = COALESCE(_verified, false) WHERE id = _user_id;
END $$;

-- 6. RPC: master admin sets broadcast avatar URL
CREATE OR REPLACE FUNCTION public.set_broadcast_avatar(_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Only master admin can change the broadcast avatar';
  END IF;
  INSERT INTO public.app_settings(key, value, updated_by, updated_at)
    VALUES ('broadcast_avatar_url', _url, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
END $$;

-- 7. RPCs for TOTP enrollment / disable
CREATE OR REPLACE FUNCTION public.start_totp_enrollment(_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _secret IS NULL OR length(_secret) < 16 THEN RAISE EXCEPTION 'Invalid secret'; END IF;
  UPDATE public.user_profiles
     SET totp_pending_secret = _secret
   WHERE id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.confirm_totp_enrollment()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _pending text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT totp_pending_secret INTO _pending FROM public.user_profiles WHERE id = auth.uid();
  IF _pending IS NULL OR length(_pending) < 16 THEN
    RAISE EXCEPTION 'No pending TOTP enrollment';
  END IF;
  UPDATE public.user_profiles
     SET totp_secret = _pending,
         totp_pending_secret = NULL,
         totp_enabled = true,
         totp_enabled_at = now()
   WHERE id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.cancel_totp_enrollment()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.user_profiles
     SET totp_pending_secret = NULL
   WHERE id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.disable_totp()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.user_profiles
     SET totp_secret = NULL,
         totp_pending_secret = NULL,
         totp_enabled = false,
         totp_enabled_at = NULL
   WHERE id = auth.uid();
END $$;

-- Helpers exposed for the enrollment flow to read back the pending secret
CREATE OR REPLACE FUNCTION public.get_my_totp_pending_secret()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT totp_pending_secret FROM public.user_profiles WHERE id = auth.uid()
$$;

-- 8. Update pre_login_lookup to also expose totp_enabled (for sign-in 2FA gate)
DROP FUNCTION IF EXISTS public.pre_login_lookup(text);
CREATE OR REPLACE FUNCTION public.pre_login_lookup(_identifier text)
 RETURNS TABLE(id uuid, email text, is_suspended boolean, account_status user_status, login_attempts integer, totp_enabled boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH norm AS (
    SELECT
      lower(trim(_identifier)) AS ident,
      regexp_replace(trim(_identifier), '\D', '', 'g') AS digits
  )
  SELECT
    up.id,
    COALESCE(au.email, up.email) AS email,
    up.is_suspended,
    up.account_status,
    up.login_attempts,
    COALESCE(up.totp_enabled, false) AS totp_enabled
  FROM public.user_profiles up
  LEFT JOIN auth.users au ON au.id = up.id,
       norm n
  WHERE up.email = n.ident
     OR lower(up.real_email) = n.ident
     OR lower(au.email) = n.ident
     OR (length(n.digits) >= 10 AND up.mobile_number LIKE '%' || right(n.digits, 10))
  LIMIT 1;
$$;

-- 9. RPC: verify TOTP code server-side and clear login_attempts on success
CREATE OR REPLACE FUNCTION public.get_my_totp_secret()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT totp_secret FROM public.user_profiles WHERE id = auth.uid()
$$;

-- 10. Lookup TOTP secret by login identifier (for the sign-in 2FA step) — admin RPC,
--     gated so it only runs in a server function with the service_role JWT.
CREATE OR REPLACE FUNCTION public.admin_get_totp_secret_by_identifier(_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role');
  _secret text;
BEGIN
  IF NOT _is_service THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  WITH norm AS (
    SELECT
      lower(trim(_identifier)) AS ident,
      regexp_replace(trim(_identifier), '\D', '', 'g') AS digits
  )
  SELECT up.totp_secret INTO _secret
    FROM public.user_profiles up
    LEFT JOIN auth.users au ON au.id = up.id,
         norm n
   WHERE up.email = n.ident
      OR lower(up.real_email) = n.ident
      OR lower(au.email) = n.ident
      OR (length(n.digits) >= 10 AND up.mobile_number LIKE '%' || right(n.digits, 10))
   LIMIT 1;
  RETURN _secret;
END $$;
