CREATE OR REPLACE FUNCTION public.pre_login_lookup(_identifier text)
RETURNS TABLE(id uuid, email text, is_suspended boolean, account_status user_status, login_attempts integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH norm AS (
    SELECT
      lower(trim(_identifier)) AS ident,
      regexp_replace(trim(_identifier), '\D', '', 'g') AS digits
  )
  SELECT
    up.id,
    COALESCE(au.email, up.email) AS email,
    up.is_suspended,
    up.account_status,
    up.login_attempts
  FROM public.user_profiles up
  LEFT JOIN auth.users au ON au.id = up.id,
       norm n
  WHERE up.email = n.ident
     OR lower(up.real_email) = n.ident
     OR lower(au.email) = n.ident
     OR (length(n.digits) >= 10 AND up.mobile_number LIKE '%' || right(n.digits, 10))
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.pre_login_lookup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pre_login_lookup(text) TO service_role;