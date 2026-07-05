CREATE TYPE public.appeal_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.report_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.content_reports(id) ON DELETE CASCADE,
  appellant_id uuid NOT NULL,
  reason text NOT NULL,
  status public.appeal_status NOT NULL DEFAULT 'pending',
  reviewer_id uuid,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX report_appeals_appellant_idx ON public.report_appeals(appellant_id);
CREATE INDEX report_appeals_status_idx ON public.report_appeals(status);
CREATE UNIQUE INDEX report_appeals_one_open_per_report_idx
  ON public.report_appeals(report_id) WHERE status = 'pending';

GRANT SELECT, INSERT ON public.report_appeals TO authenticated;
GRANT ALL ON public.report_appeals TO service_role;

ALTER TABLE public.report_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Appellants can read their own appeals"
  ON public.report_appeals FOR SELECT TO authenticated
  USING (appellant_id = auth.uid());

CREATE POLICY "Appellants can create appeals for themselves"
  ON public.report_appeals FOR INSERT TO authenticated
  WITH CHECK (appellant_id = auth.uid());

CREATE POLICY "Master admins can read all appeals"
  ON public.report_appeals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_master_admin = true));

CREATE POLICY "Master admins can update appeals"
  ON public.report_appeals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_master_admin = true));

CREATE OR REPLACE FUNCTION public.report_appeals_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER report_appeals_updated_at
  BEFORE UPDATE ON public.report_appeals
  FOR EACH ROW EXECUTE FUNCTION public.report_appeals_touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.report_appeals;