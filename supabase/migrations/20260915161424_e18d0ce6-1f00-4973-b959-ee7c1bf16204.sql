CREATE OR REPLACE FUNCTION public.search_public_users(_q text, _limit int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  mobile_number text,
  avatar_url text,
  profile_photo_visibility text,
  is_verified boolean,
  is_online boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _digits text;
  _handle text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  _q := COALESCE(trim(_q), '');
  _digits := regexp_replace(_q, '\D', '', 'g');
  _handle := lower(regexp_replace(_q, '^@', ''));

  IF length(_digits) < 7 AND (_q !~ '^@' OR length(_handle) < 3) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      up.id,
      up.full_name,
      up.username,
      CASE WHEN EXISTS (
        SELECT 1
          FROM public.contacts c
         WHERE c.user_id = auth.uid()
           AND c.contact_id = up.id
      ) THEN up.mobile_number ELSE NULL END,
      up.avatar_url,
      up.profile_photo_visibility,
      up.is_verified,
      up.is_online
    FROM public.user_profiles up
    WHERE up.id <> auth.uid()
      AND COALESCE(up.is_suspended, false) = false
      AND (
        (length(_digits) >= 7
          AND regexp_replace(COALESCE(up.mobile_number, ''), '\D', '', 'g') = _digits)
        OR (_q ~ '^@' AND length(_handle) >= 3 AND lower(up.username) = _handle)
      )
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 50));
END;
$$;

REVOKE ALL ON FUNCTION public.search_public_users(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_public_users(text, int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_recent_public_users(_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  full_name text,
  mobile_number text,
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

  RETURN QUERY
    SELECT
      up.id,
      up.full_name,
      CASE WHEN EXISTS (
        SELECT 1
          FROM public.contacts c
         WHERE c.user_id = auth.uid()
           AND c.contact_id = up.id
      ) THEN up.mobile_number ELSE NULL END,
      up.avatar_url,
      up.profile_photo_visibility,
      up.is_verified
    FROM public.user_profiles up
    WHERE up.id <> auth.uid()
      AND COALESCE(up.is_suspended, false) = false
    ORDER BY up.created_at DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 50), 100));
END;
$$;

REVOKE ALL ON FUNCTION public.list_recent_public_users(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_recent_public_users(int) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.find_users_by_mobiles(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_users_by_mobiles(text[]) TO service_role;