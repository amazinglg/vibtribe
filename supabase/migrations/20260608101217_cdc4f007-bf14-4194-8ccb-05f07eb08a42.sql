
-- 1. Prevent privilege escalation on profile INSERT
DROP POLICY IF EXISTS users_insert_own_profile ON public.user_profiles;
CREATE POLICY users_insert_own_profile ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND COALESCE(role, 'user') = 'user'
    AND COALESCE(is_master_admin, false) = false
  );

-- 2. email_campaign_recipients: explicit admin-only INSERT/UPDATE (service_role bypasses RLS)
DROP POLICY IF EXISTS admin_insert_recipients ON public.email_campaign_recipients;
CREATE POLICY admin_insert_recipients ON public.email_campaign_recipients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS admin_update_recipients ON public.email_campaign_recipients;
CREATE POLICY admin_update_recipients ON public.email_campaign_recipients
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- 3. Chat media INSERT must verify chat membership on the 2nd folder segment
DROP POLICY IF EXISTS "Users upload own chat media" ON storage.objects;
CREATE POLICY "Users upload own chat media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND (storage.foldername(name))[2] IS NOT NULL
    AND public.is_chat_participant(((storage.foldername(name))[2])::uuid)
  );
