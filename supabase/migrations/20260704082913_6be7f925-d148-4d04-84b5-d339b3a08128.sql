-- 1) TOTP: verify code server-side inside confirm_totp_enrollment so a
--    hijacked session cannot enable 2FA without proving control of the
--    authenticator app.

CREATE OR REPLACE FUNCTION public._base32_decode(_input text)
RETURNS bytea
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  clean text;
  ch text;
  idx int;
  bits int := 0;
  val int := 0;
  out bytea := ''::bytea;
BEGIN
  clean := upper(regexp_replace(coalesce(_input,''), '\s|=', '', 'g'));
  FOR i IN 1..length(clean) LOOP
    ch := substr(clean, i, 1);
    idx := position(ch in alphabet) - 1;
    IF idx < 0 THEN CONTINUE; END IF;
    val := (val << 5) | idx;
    bits := bits + 5;
    IF bits >= 8 THEN
      bits := bits - 8;
      out := out || set_byte('\x00'::bytea, 0, ((val >> bits) & 255));
    END IF;
  END LOOP;
  RETURN out;
END $$;
REVOKE ALL ON FUNCTION public._base32_decode(text) FROM public;

CREATE OR REPLACE FUNCTION public._hotp(_secret text, _counter bigint)
RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public, extensions
AS $$
DECLARE
  key bytea;
  ctr bytea := '\x0000000000000000'::bytea;
  sig bytea;
  offs int;
  code int;
  c bigint := _counter;
BEGIN
  key := public._base32_decode(_secret);
  FOR i IN REVERSE 7..0 LOOP
    ctr := set_byte(ctr, i, (c & 255)::int);
    c := c >> 8;
  END LOOP;
  sig := extensions.hmac(ctr, key, 'sha1');
  offs := get_byte(sig, length(sig)-1) & 15;
  code := ((get_byte(sig, offs) & 127) << 24)
        | ((get_byte(sig, offs+1) & 255) << 16)
        | ((get_byte(sig, offs+2) & 255) << 8)
        |  (get_byte(sig, offs+3) & 255);
  RETURN lpad((code % 1000000)::text, 6, '0');
END $$;
REVOKE ALL ON FUNCTION public._hotp(text, bigint) FROM public;

-- Drop the vulnerable no-arg confirm and replace with a code-verifying one.
DROP FUNCTION IF EXISTS public.confirm_totp_enrollment();

CREATE OR REPLACE FUNCTION public.confirm_totp_enrollment(_code text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  _pending text;
  _counter bigint := floor(extract(epoch FROM now()) / 30)::bigint;
  _match boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _code IS NULL OR _code !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'Invalid code';
  END IF;
  SELECT totp_pending_secret INTO _pending
    FROM public.user_profiles WHERE id = auth.uid();
  IF _pending IS NULL OR length(_pending) < 16 THEN
    RAISE EXCEPTION 'No pending TOTP enrollment';
  END IF;
  FOR d IN -1..1 LOOP
    IF public._hotp(_pending, _counter + d) = _code THEN
      _match := true; EXIT;
    END IF;
  END LOOP;
  IF NOT _match THEN
    RAISE EXCEPTION 'Invalid TOTP code';
  END IF;
  UPDATE public.user_profiles
     SET totp_secret = _pending,
         totp_pending_secret = NULL,
         totp_enabled = true,
         totp_enabled_at = now()
   WHERE id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.confirm_totp_enrollment(text) FROM public;
GRANT EXECUTE ON FUNCTION public.confirm_totp_enrollment(text) TO authenticated;

-- 2) Tighten admin_update_any_profile so non-master admins cannot flip
--    suspension / account_status on other admins or master admins.
--    Extend _profile_guard to expose is_suspended + account_status.
DROP POLICY IF EXISTS admin_update_any_profile ON public.user_profiles;
DROP FUNCTION IF EXISTS public._profile_guard(uuid);

CREATE OR REPLACE FUNCTION public._profile_guard(_id uuid)
RETURNS TABLE(role text, is_master_admin boolean, is_suspended boolean, account_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT up.role,
         COALESCE(up.is_master_admin,false),
         COALESCE(up.is_suspended,false),
         up.account_status::text
  FROM public.user_profiles up
  WHERE up.id = _id
$$;
REVOKE ALL ON FUNCTION public._profile_guard(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public._profile_guard(uuid) TO authenticated;

CREATE POLICY admin_update_any_profile ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (
    public.is_admin_user()
    AND (
      public.is_master_admin()
      OR (
        -- Non-master admin: role / master flag never changeable on any target
        role            = (SELECT g.role            FROM public._profile_guard(user_profiles.id) g)
        AND is_master_admin = (SELECT g.is_master_admin FROM public._profile_guard(user_profiles.id) g)
        AND (
          -- If target is a fellow admin / master admin, suspension and
          -- account_status are also locked; only the master admin can flip them.
          (
            COALESCE((SELECT g.role FROM public._profile_guard(user_profiles.id) g),'') NOT IN ('admin','master_admin')
            AND COALESCE((SELECT g.is_master_admin FROM public._profile_guard(user_profiles.id) g), false) = false
          )
          OR (
            COALESCE(is_suspended,false) = COALESCE((SELECT g.is_suspended FROM public._profile_guard(user_profiles.id) g), false)
            AND COALESCE(account_status::text,'') = COALESCE((SELECT g.account_status FROM public._profile_guard(user_profiles.id) g), '')
          )
        )
      )
    )
  );