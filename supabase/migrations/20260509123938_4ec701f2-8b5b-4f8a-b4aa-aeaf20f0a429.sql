
-- Calls table for WebRTC signaling
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL,
  callee_id uuid NOT NULL,
  chat_id uuid,
  call_type text NOT NULL CHECK (call_type IN ('voice','video')),
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','accepted','declined','missed','ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_calls_callee_status ON public.calls(callee_id, status);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON public.calls(caller_id);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants_view_calls" ON public.calls
  FOR SELECT TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

CREATE POLICY "caller_inserts_calls" ON public.calls
  FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid());

CREATE POLICY "participants_update_calls" ON public.calls
  FOR UPDATE TO authenticated
  USING (caller_id = auth.uid() OR callee_id = auth.uid())
  WITH CHECK (caller_id = auth.uid() OR callee_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

-- Enhance user_profiles for auth changes
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS real_email text,
  ADD COLUMN IF NOT EXISTS country_code text DEFAULT '+91';

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_real_email
  ON public.user_profiles(lower(real_email))
  WHERE real_email IS NOT NULL AND real_email <> '';
