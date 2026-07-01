CREATE OR REPLACE FUNCTION public.compute_mobile_hash(_mobile text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_digits text;
  v_last10 text;
BEGIN
  IF _mobile IS NULL OR _mobile = '' THEN RETURN NULL; END IF;
  v_digits := regexp_replace(_mobile, '\D', '', 'g');
  IF length(v_digits) < 7 THEN RETURN NULL; END IF;
  v_last10 := right(v_digits, 10);
  RETURN encode(
    extensions.digest(('vibtribe_v1_contact_pepper:' || v_last10)::bytea, 'sha256'),
    'hex'
  );
END;
$function$;