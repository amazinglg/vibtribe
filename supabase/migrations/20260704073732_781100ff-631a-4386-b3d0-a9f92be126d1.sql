
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS signup_reminders_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signup_reminder_last_sent_at timestamptz;

-- Lists users who verified their email but never completed onboarding.
-- Returns at most `_limit` rows that are due for the next reminder based on
-- a 24h / 72h / 7d schedule (max 3 reminders total).
CREATE OR REPLACE FUNCTION public.list_pending_signup_reminders(_limit int DEFAULT 200)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  reminders_sent int,
  email_confirmed_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    COALESCE(p.real_email, p.email, u.email) AS email,
    p.full_name,
    COALESCE(p.signup_reminders_sent, 0) AS reminders_sent,
    u.email_confirmed_at
  FROM public.user_profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email_confirmed_at IS NOT NULL
    AND COALESCE(p.profile_completed, false) = false
    AND COALESCE(p.account_status, 'active') = 'active'
    AND COALESCE(p.is_suspended, false) = false
    AND COALESCE(p.signup_reminders_sent, 0) < 3
    AND COALESCE(p.real_email, p.email, u.email) IS NOT NULL
    AND (
      -- 1st reminder: 24h after verification
      (COALESCE(p.signup_reminders_sent, 0) = 0
        AND u.email_confirmed_at < now() - interval '24 hours')
      -- 2nd reminder: 72h after last reminder
      OR (COALESCE(p.signup_reminders_sent, 0) = 1
        AND p.signup_reminder_last_sent_at IS NOT NULL
        AND p.signup_reminder_last_sent_at < now() - interval '72 hours')
      -- 3rd reminder: 7 days after last reminder
      OR (COALESCE(p.signup_reminders_sent, 0) = 2
        AND p.signup_reminder_last_sent_at IS NOT NULL
        AND p.signup_reminder_last_sent_at < now() - interval '7 days')
    )
  ORDER BY u.email_confirmed_at ASC
  LIMIT GREATEST(1, COALESCE(_limit, 200));
$$;

REVOKE ALL ON FUNCTION public.list_pending_signup_reminders(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_pending_signup_reminders(int) TO service_role;

-- Increments the reminder counter after a successful enqueue.
CREATE OR REPLACE FUNCTION public.mark_signup_reminder_sent(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.user_profiles
     SET signup_reminders_sent = COALESCE(signup_reminders_sent, 0) + 1,
         signup_reminder_last_sent_at = now()
   WHERE id = _user_id;
$$;

REVOKE ALL ON FUNCTION public.mark_signup_reminder_sent(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_signup_reminder_sent(uuid) TO service_role;
