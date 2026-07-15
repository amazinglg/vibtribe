
-- 1) content_reports: remove direct client INSERT path. All submissions go through the
-- submitReport server function (service_role), so no authenticated user should be able
-- to insert arbitrary reporter/reported/snapshot values via the Data API.
DROP POLICY IF EXISTS "Users insert own reports" ON public.content_reports;

-- 2) support_tickets: harden the anonymous/authenticated INSERT policy by validating
-- identity fields server-side via a BEFORE INSERT trigger. Authenticated users cannot
-- spoof name/email/mobile_snapshot/username_snapshot/country_code_snapshot — they are
-- overwritten from their user_profile. Anonymous users cannot supply user_id or any
-- profile-linked snapshot fields.
CREATE OR REPLACE FUNCTION public.enforce_support_ticket_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT full_name, username, mobile_number, country_code, real_email, email
      INTO p FROM public.user_profiles WHERE id = auth.uid();
    NEW.user_id := auth.uid();
    NEW.is_external := false;
    NEW.name := COALESCE(p.full_name, '');
    NEW.email := lower(COALESCE(NULLIF(p.real_email, ''), p.email, ''));
    NEW.username_snapshot := p.username;
    NEW.mobile_snapshot := p.mobile_number;
    NEW.country_code_snapshot := p.country_code;
  ELSE
    -- Anonymous: user cannot claim an existing account or attach profile snapshots.
    NEW.user_id := NULL;
    NEW.is_external := true;
    NEW.username_snapshot := NULL;
    NEW.mobile_snapshot := NULL;
    NEW.country_code_snapshot := NULL;
    -- name/email remain as provided but are clearly marked external and unverified.
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_support_ticket_identity ON public.support_tickets;
CREATE TRIGGER trg_enforce_support_ticket_identity
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_support_ticket_identity();
