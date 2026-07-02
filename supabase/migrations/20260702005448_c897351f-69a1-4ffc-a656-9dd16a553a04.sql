
ALTER TABLE public.guardian_consents ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_pending_guardian(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=_user_id AND account_status='pending_guardian');
$$;
GRANT EXECUTE ON FUNCTION public.is_pending_guardian(uuid) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.age_years(_dob date)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _dob IS NULL THEN NULL ELSE date_part('year', age(_dob))::int END;
$$;

CREATE OR REPLACE FUNCTION public.silent_dob_age_recheck()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.dob IS DISTINCT FROM OLD.dob AND NEW.dob IS NOT NULL THEN
    IF COALESCE(NEW.country_code, OLD.country_code) = '+91'
       AND public.age_years(NEW.dob) < 18
       AND COALESCE(NEW.account_status::text, 'active') IN ('active','pending_guardian') THEN
      NEW.account_status := 'pending_guardian'::public.user_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_silent_dob_age_recheck ON public.user_profiles;
CREATE TRIGGER trg_silent_dob_age_recheck
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.silent_dob_age_recheck();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='guardian-monthly-reminder') THEN
    PERFORM cron.unschedule('guardian-monthly-reminder'); END IF;
END $$;
SELECT cron.schedule('guardian-monthly-reminder','30 6 1 * *',
  $$SELECT net.http_post(
      url:='https://www.vibtribe.in/api/public/hooks/guardian-monthly-reminder',
      headers:=jsonb_build_object('Content-Type','application/json',
        'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2bHNicXZnbmZsZmN2bHdmdmJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODM1NjMsImV4cCI6MjA5Mzg1OTU2M30.MVnWNuwLgowz74u3cZM7C4R59VbYlRWPv4ZSozyh9Us'),
      body:='{}'::jsonb) AS req;$$);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='guardian-auto-graduate') THEN
    PERFORM cron.unschedule('guardian-auto-graduate'); END IF;
END $$;
SELECT cron.schedule('guardian-auto-graduate','17 * * * *',
  $$SELECT public.guardian_auto_graduate();$$);

CREATE OR REPLACE FUNCTION public.guardian_reminders_due()
RETURNS TABLE(id uuid, minor_user_id uuid, guardian_name text, guardian_email text, consent_token text, minor_full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT gc.id, gc.minor_user_id, gc.guardian_name, gc.guardian_email, gc.consent_token,
         COALESCE(up.full_name, up.username, 'A young user')
  FROM public.guardian_consents gc
  JOIN public.user_profiles up ON up.id = gc.minor_user_id
  WHERE gc.revoked_at IS NULL AND gc.graduated_at IS NULL AND gc.consented_at IS NOT NULL
    AND (gc.last_reminder_at IS NULL OR gc.last_reminder_at < now() - interval '28 days');
$$;
GRANT EXECUTE ON FUNCTION public.guardian_reminders_due() TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.mark_guardian_reminded(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.guardian_consents SET last_reminder_at=now(), updated_at=now() WHERE id=_id;
$$;
GRANT EXECUTE ON FUNCTION public.mark_guardian_reminded(uuid) TO service_role;
