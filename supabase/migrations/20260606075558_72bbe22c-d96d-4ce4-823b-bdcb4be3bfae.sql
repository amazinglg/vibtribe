
-- 3a. Marketing consent tracking columns
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent_ip text,
  ADD COLUMN IF NOT EXISTS marketing_consent_source text;

-- 3b. Reset existing users to opted-out (explicit consent required by DPDP/GDPR).
-- They will be re-prompted via in-app modal. Default also flips to false.
UPDATE public.user_profiles
   SET email_marketing_opt_in = false
 WHERE marketing_consent_at IS NULL;

ALTER TABLE public.user_profiles
  ALTER COLUMN email_marketing_opt_in SET DEFAULT false;

-- 3c. Campaigns table
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  preheader text,
  content_html text NOT NULL DEFAULT '',
  banner_image_url text,
  audience_filter jsonb NOT NULL DEFAULT '{"type":"opted_in"}'::jsonb,
  status text NOT NULL DEFAULT 'draft', -- draft|sending|sent|failed
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_admin_select_campaigns" ON public.email_campaigns
  FOR SELECT TO authenticated USING (public.is_master_admin());
CREATE POLICY "master_admin_insert_campaigns" ON public.email_campaigns
  FOR INSERT TO authenticated WITH CHECK (public.is_master_admin() AND created_by = auth.uid());
CREATE POLICY "master_admin_update_campaigns" ON public.email_campaigns
  FOR UPDATE TO authenticated USING (public.is_master_admin()) WITH CHECK (public.is_master_admin());
CREATE POLICY "master_admin_delete_campaigns" ON public.email_campaigns
  FOR DELETE TO authenticated USING (public.is_master_admin());

CREATE TRIGGER trg_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3d. Per-recipient delivery log
CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'queued', -- queued|sent|failed|skipped_suppressed|skipped_optout
  resend_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecr_campaign ON public.email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ecr_status ON public.email_campaign_recipients(campaign_id, status);

GRANT SELECT ON public.email_campaign_recipients TO authenticated;
GRANT ALL ON public.email_campaign_recipients TO service_role;

ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_admin_select_recipients" ON public.email_campaign_recipients
  FOR SELECT TO authenticated USING (public.is_master_admin());
