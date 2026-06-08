CREATE TABLE IF NOT EXISTS public.app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  note text,
  released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_releases TO authenticated;
GRANT SELECT ON public.app_releases TO anon;
GRANT ALL ON public.app_releases TO service_role;

ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read releases" ON public.app_releases;
CREATE POLICY "Anyone can read releases" ON public.app_releases
  FOR SELECT USING (true);

-- Add to realtime publication so ForceReleaseListener gets INSERT events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_releases'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.app_releases';
  END IF;
END $$;