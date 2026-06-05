
-- 1) Guard admin_reset_user_password against targeting the master admin
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id uuid, new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_is_master boolean;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Only admins can reset passwords';
  END IF;
  IF length(new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  SELECT COALESCE(is_master_admin, false) INTO target_is_master
    FROM public.user_profiles WHERE id = target_user_id;
  IF COALESCE(target_is_master, false) AND target_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot reset the master admin password';
  END IF;
  UPDATE auth.users
    SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = target_user_id;
END;
$function$;

-- 2) Restrict record_login_failure to service_role (called from server route only)
REVOKE EXECUTE ON FUNCTION public.record_login_failure(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_failure(uuid) TO service_role;

-- Also lock down pre_login_lookup and record_login_success to service_role —
-- they back the same server-side login flow and shouldn't be client-callable.
REVOKE EXECUTE ON FUNCTION public.pre_login_lookup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pre_login_lookup(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_login_success(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_success(uuid) TO service_role;
