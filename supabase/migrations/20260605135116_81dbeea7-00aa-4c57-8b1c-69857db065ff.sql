-- Per-device session tracking for Devices tab + targeted remote logout
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  device_name text NOT NULL DEFAULT 'Unknown device',
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  app_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_sessions"
  ON public.user_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id, last_seen_at DESC);

-- Targeted force-logout: when session_id is set, only that device signs out;
-- when null, the existing behaviour (log out all devices) still applies.
ALTER TABLE public.force_logout_tokens
  ADD COLUMN session_id uuid;

CREATE INDEX idx_force_logout_tokens_user_session
  ON public.force_logout_tokens(user_id, session_id);