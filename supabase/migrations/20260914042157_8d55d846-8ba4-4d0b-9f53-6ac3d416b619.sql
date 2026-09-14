DROP FUNCTION IF EXISTS public.get_public_profile_snippets(uuid[]);

CREATE FUNCTION public.get_public_profile_snippets(_ids uuid[])
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  profile_photo_visibility text,
  is_verified boolean,
  is_online boolean,
  last_seen timestamptz,
  public_key text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.full_name, up.username, up.avatar_url,
         up.profile_photo_visibility, up.is_verified, up.is_online, up.last_seen,
         up.public_key
    FROM public.user_profiles up
   WHERE auth.uid() IS NOT NULL
     AND up.id = ANY(COALESCE(_ids, ARRAY[]::uuid[]));
$$;

REVOKE ALL ON FUNCTION public.get_public_profile_snippets(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile_snippets(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_snippets(uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_fcm_token(
  _token text,
  _platform text DEFAULT 'android'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _clean_token text := btrim(COALESCE(_token, ''));
  _clean_platform text := lower(btrim(COALESCE(_platform, 'android')));
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF _clean_token = '' OR length(_clean_token) > 4096 THEN
    RAISE EXCEPTION 'Invalid device token' USING ERRCODE = '22023';
  END IF;
  IF _clean_platform NOT IN ('android', 'ios') THEN
    RAISE EXCEPTION 'Invalid platform' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.fcm_tokens (user_id, token, platform, updated_at)
  VALUES (_user_id, _clean_token, _clean_platform, now())
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        updated_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_fcm_token(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_fcm_token(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_fcm_token(text, text) TO service_role;