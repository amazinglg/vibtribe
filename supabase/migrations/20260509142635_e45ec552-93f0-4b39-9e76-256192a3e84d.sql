ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS profile_photo_visibility text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS status_visibility text NOT NULL DEFAULT 'all';
