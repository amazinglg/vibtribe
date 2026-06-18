
-- 1) user_profiles: defense in depth — revoke sensitive columns at the column-grant level
DO $$
DECLARE c text;
BEGIN
  FOREACH c IN ARRAY ARRAY[
    'totp_secret','totp_pending_secret','encrypted_private_key','key_salt','key_iv',
    'real_email','marketing_consent_ip','login_attempts'
  ] LOOP
    EXECUTE format('REVOKE SELECT (%I) ON public.user_profiles FROM authenticated', c);
    EXECUTE format('REVOKE SELECT (%I) ON public.user_profiles FROM anon', c);
  END LOOP;
END $$;

-- Harden admin list/get RPCs to never expose secret material via the Data API.
-- They keep returning user_profiles, but blank the sensitive columns.
CREATE OR REPLACE FUNCTION public.admin_list_user_profiles()
RETURNS SETOF public.user_profiles
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY
    SELECT (up).*::public.user_profiles
    FROM (
      SELECT
        up.*,
        NULL::text AS _redact
      FROM public.user_profiles up
    ) up;
END;
$fn$;

-- Simpler & safer: rewrite to explicitly null out sensitive cols
CREATE OR REPLACE FUNCTION public.admin_list_user_profiles()
RETURNS SETOF public.user_profiles
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE r public.user_profiles;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  FOR r IN SELECT * FROM public.user_profiles ORDER BY created_at DESC LOOP
    r.totp_secret := NULL;
    r.totp_pending_secret := NULL;
    r.encrypted_private_key := NULL;
    r.key_salt := NULL;
    r.key_iv := NULL;
    RETURN NEXT r;
  END LOOP;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_get_user_profile(_user_id uuid)
RETURNS public.user_profiles
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE r public.user_profiles;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  SELECT * INTO r FROM public.user_profiles WHERE id = _user_id;
  r.totp_secret := NULL;
  r.totp_pending_secret := NULL;
  r.encrypted_private_key := NULL;
  r.key_salt := NULL;
  r.key_iv := NULL;
  RETURN r;
END;
$fn$;

-- 2) apk_download_events: validate anonymous inserts
DROP POLICY IF EXISTS anyone_insert_download_events ON public.apk_download_events;
CREATE POLICY anyone_insert_download_events ON public.apk_download_events
FOR INSERT TO anon, authenticated
WITH CHECK (
  (referrer     IS NULL OR length(referrer)     <= 500)
  AND (user_agent IS NULL OR length(user_agent) <= 500)
  AND (ip_hash    IS NULL OR length(ip_hash)    <= 128)
);

-- 3) chats: remove overlapping UPDATE paths so only leaders/admins update group chats
DROP POLICY IF EXISTS creators_update_group_chats ON public.chats;
DROP POLICY IF EXISTS users_manage_own_chats ON public.chats;

-- Re-create the 1:1 ownership policy scoped to non-group rows only
CREATE POLICY users_manage_own_direct_chats ON public.chats
FOR ALL TO authenticated
USING (
  COALESCE(is_group, false) = false
  AND (participant_one = auth.uid() OR participant_two = auth.uid())
)
WITH CHECK (
  COALESCE(is_group, false) = false
  AND (participant_one = auth.uid() OR participant_two = auth.uid())
);
