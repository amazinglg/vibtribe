
DROP POLICY IF EXISTS master_admin_select_campaigns ON public.email_campaigns;
DROP POLICY IF EXISTS master_admin_insert_campaigns ON public.email_campaigns;
DROP POLICY IF EXISTS master_admin_update_campaigns ON public.email_campaigns;
DROP POLICY IF EXISTS master_admin_delete_campaigns ON public.email_campaigns;

CREATE POLICY admin_select_campaigns ON public.email_campaigns FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY admin_insert_campaigns ON public.email_campaigns FOR INSERT TO authenticated WITH CHECK (public.is_admin_user() AND created_by = auth.uid());
CREATE POLICY admin_update_campaigns ON public.email_campaigns FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY admin_delete_campaigns ON public.email_campaigns FOR DELETE TO authenticated USING (public.is_admin_user());

DROP POLICY IF EXISTS master_admin_select_recipients ON public.email_campaign_recipients;
CREATE POLICY admin_select_recipients ON public.email_campaign_recipients FOR SELECT TO authenticated USING (public.is_admin_user());
