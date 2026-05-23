-- One-time backfill: assign auto-generated usernames to users who don't have one
DO $$
DECLARE
  r RECORD;
  base_name TEXT;
  candidate TEXT;
  attempts INT;
BEGIN
  FOR r IN
    SELECT id, full_name, email, mobile_number
    FROM public.user_profiles
    WHERE username IS NULL OR username = ''
  LOOP
    -- Derive base from full_name first word, fallback to mobile, fallback to 'user'
    base_name := LOWER(REGEXP_REPLACE(COALESCE(SPLIT_PART(r.full_name, ' ', 1), ''), '[^a-z0-9_]', '', 'gi'));
    IF base_name IS NULL OR LENGTH(base_name) < 3 THEN
      base_name := 'user' || RIGHT(REGEXP_REPLACE(COALESCE(r.mobile_number, ''), '[^0-9]', '', 'g'), 4);
    END IF;
    IF base_name IS NULL OR LENGTH(base_name) < 3 THEN
      base_name := 'user';
    END IF;

    attempts := 0;
    LOOP
      candidate := base_name || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE username = candidate);
      attempts := attempts + 1;
      EXIT WHEN attempts > 10;
    END LOOP;

    UPDATE public.user_profiles SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- Add a unique index on username (case-insensitive) if not present
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_unique_idx
  ON public.user_profiles (LOWER(username))
  WHERE username IS NOT NULL AND username <> '';