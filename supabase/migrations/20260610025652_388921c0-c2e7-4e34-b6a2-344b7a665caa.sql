DROP POLICY IF EXISTS "Anyone can read releases" ON public.app_releases;
CREATE POLICY "Authenticated can read releases" ON public.app_releases FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.app_releases FROM anon;