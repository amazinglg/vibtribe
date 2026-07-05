
-- Enums
DO $$ BEGIN
  CREATE TYPE public.report_type AS ENUM ('message','image','video','file','audio','profile','chat','status','tribe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_reason AS ENUM (
    'child_safety','nudity_sexual','harassment_bullying','hate_speech','violence','spam',
    'scam_fraud','fake_profile','impersonation','terrorism','illegal_activity',
    'self_harm','privacy_violation','copyright','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM ('pending','true_positive','false_positive','dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- content_reports
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name text,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_user_name text,
  report_type public.report_type NOT NULL,
  reason public.report_reason NOT NULL,
  comments text,
  chat_id uuid,
  message_id uuid,
  status_id uuid,
  target_ref text,
  priority smallint NOT NULL DEFAULT 0,
  status public.report_status NOT NULL DEFAULT 'pending',
  moderator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moderator_notes text,
  moderated_at timestamptz,
  action_taken text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.content_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.content_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON public.content_reports(priority DESC, created_at DESC);

GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Reporter can insert their own reports
CREATE POLICY "Users insert own reports"
  ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Reporter can view their own reports; master admins can view all
CREATE POLICY "Reporter or master reads reports"
  ON public.content_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_master_admin());

-- Only master admins can update / delete
CREATE POLICY "Master admin updates reports"
  ON public.content_reports FOR UPDATE TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

CREATE POLICY "Master admin deletes reports"
  ON public.content_reports FOR DELETE TO authenticated
  USING (public.is_master_admin());

-- Auto-set priority for CSAE-related reasons + auto-fill reporter_name
CREATE OR REPLACE FUNCTION public.content_reports_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reason = 'child_safety' THEN
    NEW.priority := 10;
  END IF;
  IF NEW.reporter_name IS NULL OR NEW.reporter_name = '' THEN
    SELECT COALESCE(full_name, username, 'User') INTO NEW.reporter_name
      FROM public.user_profiles WHERE id = NEW.reporter_id;
  END IF;
  IF NEW.reported_user_id IS NOT NULL AND (NEW.reported_user_name IS NULL OR NEW.reported_user_name = '') THEN
    SELECT COALESCE(full_name, username, 'User') INTO NEW.reported_user_name
      FROM public.user_profiles WHERE id = NEW.reported_user_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_content_reports_bi ON public.content_reports;
CREATE TRIGGER trg_content_reports_bi
  BEFORE INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.content_reports_before_insert();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_content_reports_ua ON public.content_reports;
CREATE TRIGGER trg_content_reports_ua
  BEFORE UPDATE ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime for admin badge / live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_reports;

-- Moderation audit log
CREATE TABLE IF NOT EXISTS public.moderation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.content_reports(id) ON DELETE CASCADE,
  moderator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  moderator_name text,
  action text NOT NULL,
  notes text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mod_audit_report ON public.moderation_audit_log(report_id, created_at DESC);

GRANT SELECT ON public.moderation_audit_log TO authenticated;
GRANT ALL ON public.moderation_audit_log TO service_role;

ALTER TABLE public.moderation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admin reads audit log"
  ON public.moderation_audit_log FOR SELECT TO authenticated
  USING (public.is_master_admin());
-- writes go through service_role (server function); no INSERT policy for authenticated

-- Storage: moderation-evidence bucket — master-admin-only access
CREATE POLICY "Master admin reads moderation evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'moderation-evidence' AND public.is_master_admin());

CREATE POLICY "Master admin manages moderation evidence"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'moderation-evidence' AND public.is_master_admin())
  WITH CHECK (bucket_id = 'moderation-evidence' AND public.is_master_admin());
