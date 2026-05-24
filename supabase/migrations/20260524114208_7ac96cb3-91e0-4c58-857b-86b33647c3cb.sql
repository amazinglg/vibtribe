
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS dob date;

CREATE OR REPLACE FUNCTION public.validate_user_dob()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.dob IS NOT NULL THEN
    IF NEW.dob > (CURRENT_DATE - INTERVAL '18 years')::date THEN
      RAISE EXCEPTION 'You must be at least 18 years old to use VibTribe';
    END IF;
    IF NEW.dob < '1900-01-01'::date THEN
      RAISE EXCEPTION 'Please enter a valid date of birth';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_validate_dob ON public.user_profiles;
CREATE TRIGGER user_profiles_validate_dob
BEFORE INSERT OR UPDATE OF dob ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_user_dob();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dob date;
BEGIN
  BEGIN
    _dob := NULLIF(NEW.raw_user_meta_data->>'dob','')::date;
  EXCEPTION WHEN OTHERS THEN
    _dob := NULL;
  END;

  INSERT INTO public.user_profiles (id, email, full_name, mobile_number, role, avatar_url, dob)
  VALUES (
    NEW.id, COALESCE(NEW.email,''),
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'mobile_number',''),
    'user',
    COALESCE(NEW.raw_user_meta_data->>'avatar_url',''),
    _dob
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
