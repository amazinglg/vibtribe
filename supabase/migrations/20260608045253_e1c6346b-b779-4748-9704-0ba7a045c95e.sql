-- 1. APK download events
CREATE TABLE public.apk_download_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text,
  user_agent text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.apk_download_events TO anon, authenticated;
GRANT SELECT ON public.apk_download_events TO authenticated;
GRANT ALL ON public.apk_download_events TO service_role;
ALTER TABLE public.apk_download_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_insert_download_events" ON public.apk_download_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins_read_download_events" ON public.apk_download_events FOR SELECT TO authenticated USING (is_admin_user());

CREATE INDEX idx_apk_download_events_created_at ON public.apk_download_events (created_at DESC);

-- 2. Chat mutes
CREATE TABLE public.chat_mutes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  chat_id uuid NOT NULL,
  muted_until timestamptz,  -- NULL = forever
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chat_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_mutes TO authenticated;
GRANT ALL ON public.chat_mutes TO service_role;
ALTER TABLE public.chat_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_mutes" ON public.chat_mutes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_chat_mutes_user_chat ON public.chat_mutes (user_id, chat_id);

-- Helper: is a chat muted for a user right now?
CREATE OR REPLACE FUNCTION public.is_chat_muted(_user_id uuid, _chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_mutes
    WHERE user_id = _user_id
      AND chat_id = _chat_id
      AND (muted_until IS NULL OR muted_until > now())
  );
$$;

-- 3. Permission/device toggle preferences on user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS pref_mic_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_camera_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_contacts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pref_notifications_enabled boolean NOT NULL DEFAULT true;

-- 4. Schedule cleanup of expired statuses (cron job — registered after route deploys; uses anon key header)
-- Note: We register the actual cron.schedule call separately via insert tool after the route exists.