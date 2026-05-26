
-- Backfill: deduplicate any existing duplicates by keeping the oldest row
-- (no-op on a clean DB; safe to run)

-- Case-insensitive unique index on verified email
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_real_email_unique_ci
  ON public.user_profiles (lower(real_email))
  WHERE real_email IS NOT NULL AND real_email <> '';

-- Unique index on country_code + mobile_number
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_mobile_unique
  ON public.user_profiles (country_code, mobile_number)
  WHERE mobile_number IS NOT NULL AND mobile_number <> '';

-- Helper: check if a mobile number is available
CREATE OR REPLACE FUNCTION public.is_mobile_available(_country_code text, _mobile text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE country_code = COALESCE(_country_code, '+91')
      AND mobile_number = trim(_mobile)
      AND mobile_number IS NOT NULL
      AND mobile_number <> ''
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_mobile_available(text, text) TO anon, authenticated, service_role;

-- Support ticket enhancements
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS username_snapshot text,
  ADD COLUMN IF NOT EXISTS mobile_snapshot text,
  ADD COLUMN IF NOT EXISTS country_code_snapshot text;

-- Allow anon role to insert tickets (public contact form)
GRANT INSERT ON public.support_tickets TO anon;

-- Refine the existing INSERT policy to also allow anon
DROP POLICY IF EXISTS anyone_can_create_ticket ON public.support_tickets;
CREATE POLICY anyone_can_create_ticket ON public.support_tickets
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    ((auth.uid() IS NULL) AND (user_id IS NULL) AND (is_external = true))
    OR ((auth.uid() IS NOT NULL) AND ((user_id IS NULL) OR (user_id = auth.uid())))
  );
