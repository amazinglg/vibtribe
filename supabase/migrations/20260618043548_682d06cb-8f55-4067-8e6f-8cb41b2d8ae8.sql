DROP POLICY IF EXISTS "app_settings public read" ON public.app_settings;
REVOKE SELECT ON public.app_settings FROM anon;
CREATE POLICY "app_settings authenticated read"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);