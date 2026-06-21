
DROP VIEW IF EXISTS public.app_releases_public;
CREATE VIEW public.app_releases_public
  WITH (security_invoker = true) AS
  SELECT id, version, released_at
    FROM public.app_releases;
GRANT SELECT ON public.app_releases_public TO authenticated, anon;

-- Re-add a SELECT policy on the base table so the security-invoker view
-- can return rows. Column-level grants below ensure only id/version/
-- released_at are reachable for non-admins; note + released_by remain
-- admin-only via service_role / admin_* RPCs.
DROP POLICY IF EXISTS "Public can read release version columns" ON public.app_releases;
CREATE POLICY "Public can read release version columns"
  ON public.app_releases
  FOR SELECT
  TO authenticated, anon
  USING (true);

REVOKE SELECT (note, released_by) ON public.app_releases FROM authenticated;
REVOKE SELECT (note, released_by) ON public.app_releases FROM anon;
