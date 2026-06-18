-- Verify the master admin account
UPDATE public.user_profiles
   SET is_verified = true
 WHERE is_master_admin = true
    OR regexp_replace(coalesce(mobile_number,''), '\D', '', 'g') LIKE '%9826016419';

-- Keep master admin auto-verified
CREATE OR REPLACE FUNCTION public.auto_verify_master()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_master_admin, false) = true THEN
    NEW.is_verified := true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_verify_master ON public.user_profiles;
CREATE TRIGGER trg_auto_verify_master
BEFORE INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_verify_master();