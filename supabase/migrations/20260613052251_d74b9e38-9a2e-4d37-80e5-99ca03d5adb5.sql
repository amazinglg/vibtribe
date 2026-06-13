CREATE OR REPLACE FUNCTION public.validate_user_dob()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.dob IS NOT NULL THEN
    IF NEW.dob > (CURRENT_DATE - INTERVAL '13 years')::date THEN
      RAISE EXCEPTION 'You must be at least 13 years old to use VibTribe';
    END IF;
    IF NEW.dob < '1900-01-01'::date THEN
      RAISE EXCEPTION 'Please enter a valid date of birth';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;