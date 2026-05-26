CREATE OR REPLACE FUNCTION public.is_admin_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role = 'admin' OR up.is_master_admin = true)
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND (role = 'admin' OR is_master_admin = true)
  )
$function$;