
-- 1. Private table
CREATE TABLE IF NOT EXISTS public.user_profiles_private (
  id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  encrypted_private_key text,
  key_salt text,
  key_iv text,
  totp_secret text,
  totp_pending_secret text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No grants to anon/authenticated. Only service_role.
GRANT ALL ON public.user_profiles_private TO service_role;

ALTER TABLE public.user_profiles_private ENABLE ROW LEVEL SECURITY;

-- Deny-all: no policies for authenticated/anon; SECURITY DEFINER funcs bypass RLS.
CREATE POLICY "service_role_only" ON public.user_profiles_private
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Backfill from user_profiles
INSERT INTO public.user_profiles_private (id, encrypted_private_key, key_salt, key_iv, totp_secret, totp_pending_secret)
SELECT id, encrypted_private_key, key_salt, key_iv, totp_secret, totp_pending_secret
FROM public.user_profiles
WHERE encrypted_private_key IS NOT NULL
   OR key_salt IS NOT NULL
   OR key_iv IS NOT NULL
   OR totp_secret IS NOT NULL
   OR totp_pending_secret IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Update SECURITY DEFINER functions BEFORE dropping columns

CREATE OR REPLACE FUNCTION public.get_my_encryption_material()
 RETURNS TABLE(public_key text, encrypted_private_key text, key_salt text, key_iv text, key_setup_completed boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT up.public_key, p.encrypted_private_key, p.key_salt, p.key_iv, up.key_setup_completed
  FROM public.user_profiles up
  LEFT JOIN public.user_profiles_private p ON p.id = up.id
  WHERE up.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_totp_secret()
 RETURNS text
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT totp_secret FROM public.user_profiles_private WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_totp_pending_secret()
 RETURNS text
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT totp_pending_secret FROM public.user_profiles_private WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.start_totp_enrollment(_secret text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _secret IS NULL OR length(_secret) < 16 THEN RAISE EXCEPTION 'Invalid secret'; END IF;
  INSERT INTO public.user_profiles_private (id, totp_pending_secret)
    VALUES (auth.uid(), _secret)
  ON CONFLICT (id) DO UPDATE SET totp_pending_secret = EXCLUDED.totp_pending_secret, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.cancel_totp_enrollment()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.user_profiles_private
     SET totp_pending_secret = NULL, updated_at = now()
   WHERE id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.confirm_totp_enrollment(_code text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _pending text;
  _counter bigint := floor(extract(epoch FROM now()) / 30)::bigint;
  _match boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _code IS NULL OR _code !~ '^\d{6}$' THEN RAISE EXCEPTION 'Invalid code'; END IF;
  SELECT totp_pending_secret INTO _pending
    FROM public.user_profiles_private WHERE id = auth.uid();
  IF _pending IS NULL OR length(_pending) < 16 THEN
    RAISE EXCEPTION 'No pending TOTP enrollment';
  END IF;
  FOR d IN -1..1 LOOP
    IF public._hotp(_pending, _counter + d) = _code THEN
      _match := true; EXIT;
    END IF;
  END LOOP;
  IF NOT _match THEN RAISE EXCEPTION 'Invalid TOTP code'; END IF;
  UPDATE public.user_profiles_private
     SET totp_secret = _pending, totp_pending_secret = NULL, updated_at = now()
   WHERE id = auth.uid();
  UPDATE public.user_profiles
     SET totp_enabled = true, totp_enabled_at = now()
   WHERE id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.disable_totp()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.user_profiles_private
     SET totp_secret = NULL, totp_pending_secret = NULL, updated_at = now()
   WHERE id = auth.uid();
  UPDATE public.user_profiles
     SET totp_enabled = false, totp_enabled_at = NULL
   WHERE id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.admin_get_totp_secret_by_identifier(_identifier text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _is_service boolean := (current_setting('request.jwt.claim.role', true) = 'service_role');
  _secret text;
BEGIN
  IF NOT _is_service THEN RAISE EXCEPTION 'service role required'; END IF;
  WITH norm AS (
    SELECT lower(trim(_identifier)) AS ident,
           regexp_replace(trim(_identifier), '\D', '', 'g') AS digits
  )
  SELECT p.totp_secret INTO _secret
    FROM public.user_profiles up
    LEFT JOIN auth.users au ON au.id = up.id
    LEFT JOIN public.user_profiles_private p ON p.id = up.id,
         norm n
   WHERE up.email = n.ident
      OR lower(up.real_email) = n.ident
      OR lower(au.email) = n.ident
      OR (length(n.digits) >= 10 AND up.mobile_number LIKE '%' || right(n.digits, 10))
   LIMIT 1;
  RETURN _secret;
END $$;

-- New: set encryption material (setup + change PIN)
CREATE OR REPLACE FUNCTION public.set_my_encryption_material(
  _public_key text,
  _encrypted_private_key text,
  _key_salt text,
  _key_iv text,
  _mark_setup boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _encrypted_private_key IS NULL OR _key_salt IS NULL OR _key_iv IS NULL THEN
    RAISE EXCEPTION 'Missing encryption material';
  END IF;
  INSERT INTO public.user_profiles_private (id, encrypted_private_key, key_salt, key_iv)
    VALUES (auth.uid(), _encrypted_private_key, _key_salt, _key_iv)
  ON CONFLICT (id) DO UPDATE
    SET encrypted_private_key = EXCLUDED.encrypted_private_key,
        key_salt = EXCLUDED.key_salt,
        key_iv = EXCLUDED.key_iv,
        updated_at = now();
  IF _mark_setup THEN
    UPDATE public.user_profiles
       SET public_key = COALESCE(_public_key, public_key),
           key_setup_completed = true
     WHERE id = auth.uid();
  ELSIF _public_key IS NOT NULL THEN
    UPDATE public.user_profiles
       SET public_key = _public_key
     WHERE id = auth.uid();
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.set_my_encryption_material(text, text, text, text, boolean) TO authenticated;

-- admin_get_user_profile and admin_list_user_profiles already NULL out these
-- columns before returning. After the column drop below, remove those assignments.
CREATE OR REPLACE FUNCTION public.admin_get_user_profile(_user_id uuid)
 RETURNS user_profiles LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r public.user_profiles;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO r FROM public.user_profiles WHERE id = _user_id;
  RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_user_profiles()
 RETURNS SETOF user_profiles LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r public.user_profiles;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  FOR r IN SELECT * FROM public.user_profiles ORDER BY created_at DESC LOOP
    RETURN NEXT r;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_premium(_user_id uuid)
 RETURNS user_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r public.user_profiles;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'premium.manage') THEN
    RAISE EXCEPTION 'Premium management permission required';
  END IF;
  UPDATE public.user_profiles
     SET is_premium = false, premium_expires_at = NULL, premium_source = NULL
   WHERE id = _user_id
  RETURNING * INTO r;
  IF r.id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_premium(_user_id uuid, _months integer, _forever boolean DEFAULT false)
 RETURNS user_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  r public.user_profiles;
  new_expiry timestamptz;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'premium.manage') THEN
    RAISE EXCEPTION 'Premium management permission required';
  END IF;
  IF _forever THEN
    new_expiry := NULL;
  ELSE
    IF _months NOT IN (1,3,6,12) THEN
      RAISE EXCEPTION 'Months must be 1, 3, 6 or 12 (or use forever=true)';
    END IF;
    new_expiry := now() + make_interval(months => _months);
  END IF;
  UPDATE public.user_profiles
     SET is_premium = true,
         premium_expires_at = new_expiry,
         premium_granted_at = now(),
         premium_granted_by = auth.uid(),
         premium_source = CASE WHEN _forever THEN 'forever' ELSE 'manual' END
   WHERE id = _user_id
  RETURNING * INTO r;
  IF r.id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  RETURN r;
END; $$;

-- 4. Drop sensitive columns from user_profiles
ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS encrypted_private_key,
  DROP COLUMN IF EXISTS key_salt,
  DROP COLUMN IF EXISTS key_iv,
  DROP COLUMN IF EXISTS totp_secret,
  DROP COLUMN IF EXISTS totp_pending_secret;
