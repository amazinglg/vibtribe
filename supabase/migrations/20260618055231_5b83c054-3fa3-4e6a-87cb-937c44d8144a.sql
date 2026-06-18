
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS terms_warning_sent_at timestamptz;
