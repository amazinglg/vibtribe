
-- =====================================================================
-- 1. app_releases: only admins can read full table. Public view exposes
--    only the non-sensitive columns the client needs.
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated can read releases" ON public.app_releases;
DROP POLICY IF EXISTS "Anyone can read releases" ON public.app_releases;
DROP POLICY IF EXISTS "Admins can read full releases" ON public.app_releases;

CREATE POLICY "Admins can read full releases"
  ON public.app_releases
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- Public-safe projection (no note, no released_by).
DROP VIEW IF EXISTS public.app_releases_public;
CREATE VIEW public.app_releases_public
  WITH (security_invoker = true) AS
  SELECT id, version, released_at
    FROM public.app_releases;

GRANT SELECT ON public.app_releases_public TO authenticated, anon;

-- Allow the view's underlying SELECT to succeed for everyone (the view
-- only projects safe columns, and column-level grants on the table
-- already block note/released_by for anon/authenticated).
DROP POLICY IF EXISTS "Public can read release version" ON public.app_releases;
CREATE POLICY "Public can read release version"
  ON public.app_releases
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Re-assert column-level revokes (idempotent) so even direct table reads
-- cannot return the sensitive columns to regular users.
REVOKE SELECT (note, released_by) ON public.app_releases FROM authenticated;
REVOKE SELECT (note, released_by) ON public.app_releases FROM anon;

-- =====================================================================
-- 2. user_profiles: replace the blanket SELECT policy with one that only
--    returns rows the caller has a real relationship to.
-- =====================================================================
DROP POLICY IF EXISTS "authenticated_can_select_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated can select user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_select_related_profiles" ON public.user_profiles;

CREATE POLICY "users_select_related_profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- self
    auth.uid() = id
    -- admins / master admin
    OR public.is_admin_user()
    -- a contact saved by the caller
    OR EXISTS (
      SELECT 1 FROM public.contacts c
       WHERE c.user_id = auth.uid() AND c.contact_id = user_profiles.id
    )
    -- 1:1 chat participant
    OR EXISTS (
      SELECT 1 FROM public.chats ch
       WHERE (ch.participant_one = auth.uid() AND ch.participant_two = user_profiles.id)
          OR (ch.participant_two = auth.uid() AND ch.participant_one = user_profiles.id)
    )
    -- shared group/tribe
    OR EXISTS (
      SELECT 1
        FROM public.chat_members m1
        JOIN public.chat_members m2 ON m1.chat_id = m2.chat_id
       WHERE m1.user_id = auth.uid() AND m2.user_id = user_profiles.id
    )
    -- blocked-user records (either direction)
    OR EXISTS (
      SELECT 1 FROM public.blocked_users b
       WHERE (b.blocker_id = auth.uid() AND b.blocked_user_id = user_profiles.id)
          OR (b.blocker_id = user_profiles.id AND b.blocked_user_id = auth.uid())
    )
    -- recent call partner
    OR EXISTS (
      SELECT 1 FROM public.calls cl
       WHERE (cl.caller_id = auth.uid() AND cl.callee_id = user_profiles.id)
          OR (cl.callee_id = auth.uid() AND cl.caller_id = user_profiles.id)
    )
  );

-- =====================================================================
-- 3. Discovery RPCs — return ONLY safe public columns, so search,
--    contact matching and group creation keep working without leaking
--    sensitive fields.
-- =====================================================================

-- 3a. Substring search by name / username / mobile digits.
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
  IF _q = '' THEN
    RETURN;
  END IF;
  _digits := regexp_replace(_q, '\D', '', 'g');
  _handle := lower(regexp_replace(_q, '^@', ''));

  RETURN QUERY
    SELECT up.id, up.full_name, up.username, up.mobile_number,
           up.avatar_url, up.profile_photo_visibility, up.is_verified, up.is_online
      FROM public.user_profiles up
     WHERE up.id <> auth.uid()
       AND COALESCE(up.is_suspended, false) = false
       AND (
         (length(_digits) >= 7 AND up.mobile_number ILIKE '%' || _digits || '%')
         OR (length(_handle) >= 2 AND up.username ILIKE _handle || '%')
         OR (length(_q) >= 2 AND up.full_name ILIKE '%' || _q || '%')
       )
     LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 50));
END;
$$;

REVOKE ALL ON FUNCTION public.search_public_users(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_users(text, int) TO authenticated;

-- 3b. Bulk lookup by mobile number list (used by contact matching).
CREATE OR REPLACE FUNCTION public.find_users_by_mobiles(_mobiles text[])
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
  IF _mobiles IS NULL OR array_length(_mobiles, 1) IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT up.id, up.full_name, up.mobile_number,
           up.avatar_url, up.profile_photo_visibility, up.is_verified
      FROM public.user_profiles up
     WHERE up.id <> auth.uid()
       AND up.mobile_number IS NOT NULL
       AND up.mobile_number <> ''
       AND EXISTS (
         SELECT 1 FROM unnest(_mobiles) m(d)
          WHERE up.mobile_number ILIKE '%' || regexp_replace(m.d, '\D', '', 'g') || '%'
       )
     LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.find_users_by_mobiles(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_users_by_mobiles(text[]) TO authenticated;

-- 3c. List a sample of platform users (for "find people" / new group screen).
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
    SELECT up.id, up.full_name, up.mobile_number,
           up.avatar_url, up.profile_photo_visibility, up.is_verified
      FROM public.user_profiles up
     WHERE up.id <> auth.uid()
       AND COALESCE(up.is_suspended, false) = false
     ORDER BY up.created_at DESC NULLS LAST
     LIMIT GREATEST(1, LEAST(COALESCE(_limit, 50), 100));
END;
$$;

REVOKE ALL ON FUNCTION public.list_recent_public_users(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_recent_public_users(int) TO authenticated;

-- 3d. Username availability check for the edit-profile screen.
CREATE OR REPLACE FUNCTION public.is_username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE username ILIKE trim(_username)
       AND id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

REVOKE ALL ON FUNCTION public.is_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO authenticated, anon;

-- 3e. Return any admin id (used by the help button to ping an admin).
CREATE OR REPLACE FUNCTION public.get_any_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.user_profiles
   WHERE role = 'admin' OR is_master_admin = true
   ORDER BY is_master_admin DESC, created_at ASC
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_any_admin_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_any_admin_id() TO authenticated, anon;
