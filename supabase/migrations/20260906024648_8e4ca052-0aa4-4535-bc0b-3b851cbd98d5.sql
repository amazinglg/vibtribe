-- Allow the public version view (id, version, released_at) to work for all users.
GRANT SELECT (id, version, released_at) ON public.app_releases TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read release markers" ON public.app_releases;
CREATE POLICY "Public can read release markers"
  ON public.app_releases FOR SELECT
  TO anon, authenticated
  USING (true);