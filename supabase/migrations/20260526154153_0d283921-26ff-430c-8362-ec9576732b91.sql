
CREATE OR REPLACE FUNCTION public.is_mobile_available(_country_code text, _mobile text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE mobile_number IS NOT NULL
      AND mobile_number <> ''
      AND regexp_replace(coalesce(mobile_number,''), '\D', '', 'g')
          LIKE '%' || regexp_replace(coalesce(_mobile,''), '\D', '', 'g')
  );
$$;
