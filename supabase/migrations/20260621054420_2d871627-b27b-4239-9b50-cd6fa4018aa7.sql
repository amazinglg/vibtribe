
-- Drop the broad public SELECT policy; only admins can read the table directly.
DROP POLICY IF EXISTS "Public can read release version" ON public.app_releases;

-- Recreate the public projection as a SECURITY DEFINER-style view so it
-- doesn't depend on the caller having row-level access to the table.
DROP VIEW IF EXISTS public.app_releases_public;
CREATE VIEW public.app_releases_public
  WITH (security_invoker = false) AS
  SELECT id, version, released_at
    FROM public.app_releases;

ALTER VIEW public.app_releases_public OWNER TO postgres;
GRANT SELECT ON public.app_releases_public TO authenticated, anon;
