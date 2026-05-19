CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_unique
ON public.user_profiles (lower(username))
WHERE username IS NOT NULL AND username <> '';