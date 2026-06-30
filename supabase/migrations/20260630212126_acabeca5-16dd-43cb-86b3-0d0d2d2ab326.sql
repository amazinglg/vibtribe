CREATE TABLE public.subprocessor_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.subprocessor_subscribers TO anon, authenticated;
GRANT ALL ON public.subprocessor_subscribers TO service_role;

ALTER TABLE public.subprocessor_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (write-only); no SELECT policy means no public reads.
CREATE POLICY "Anyone can subscribe"
  ON public.subprocessor_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND length(email) <= 255);