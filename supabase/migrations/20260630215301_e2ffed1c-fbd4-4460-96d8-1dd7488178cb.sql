
-- 1) record_consent: drop client-supplied IP / UA, derive server-side
DROP FUNCTION IF EXISTS public.record_consent(text, text, text, text);

CREATE OR REPLACE FUNCTION public.record_consent(
  _consent_type text,
  _policy_version text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _id uuid;
  _hdrs json;
  _ip text;
  _ua text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _consent_type NOT IN ('terms','privacy') THEN
    RAISE EXCEPTION 'invalid consent_type';
  END IF;

  BEGIN
    _hdrs := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN _hdrs := NULL; END;

  IF _hdrs IS NOT NULL THEN
    _ip := COALESCE(
      split_part(COALESCE(_hdrs->>'x-forwarded-for',''), ',', 1),
      _hdrs->>'cf-connecting-ip'
    );
    IF _ip = '' THEN _ip := NULL; END IF;
    _ua := left(COALESCE(_hdrs->>'user-agent',''), 512);
    IF _ua = '' THEN _ua := NULL; END IF;
  END IF;

  BEGIN
    IF _ip IS NULL THEN
      _ip := host(inet_client_addr());
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  INSERT INTO public.consent_log (user_id, consent_type, policy_version, ip, user_agent)
  VALUES (auth.uid(), _consent_type, _policy_version, _ip, _ua)
  RETURNING id INTO _id;

  IF _consent_type = 'terms' THEN
    UPDATE public.user_profiles SET terms_accepted_at = now() WHERE id = auth.uid();
  ELSE
    UPDATE public.user_profiles SET privacy_accepted_at = now() WHERE id = auth.uid();
  END IF;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_consent(text, text) TO authenticated;

-- 2) chat-media uploader self-read: require chat membership
DROP POLICY IF EXISTS "Participants read chat media" ON storage.objects;
CREATE POLICY "Participants read chat media" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND public.is_chat_participant(((storage.foldername(name))[2])::uuid)
);

-- 3) subprocessor_subscribers: explicit admin-only SELECT for clarity
DROP POLICY IF EXISTS subprocessor_subscribers_admin_select ON public.subprocessor_subscribers;
CREATE POLICY subprocessor_subscribers_admin_select
ON public.subprocessor_subscribers
FOR SELECT TO authenticated
USING (public.is_admin_user());

-- 4) user_profiles: revoke SELECT on sensitive columns from non-owner roles.
-- Owners continue to read these via SECURITY DEFINER RPCs
-- (get_my_full_profile, get_my_encryption_material, get_my_totp_*).
REVOKE SELECT ON public.user_profiles FROM authenticated, anon;

GRANT SELECT (
  id, email, full_name, mobile_number, username, bio, avatar_url, role,
  is_online, last_seen, profile_completed, public_key,
  created_at, updated_at, app_theme, country_code, is_master_admin,
  profile_photo_visibility, status_visibility, terms_accepted_at,
  privacy_accepted_at, is_verified, totp_enabled, totp_enabled_at,
  mobile_hash
) ON public.user_profiles TO authenticated;

-- anon needs nothing from this table (no anon-readable policy exists)
