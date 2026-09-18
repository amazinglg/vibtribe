DROP POLICY IF EXISTS users_update_own_profile_safe ON public.user_profiles;

CREATE POLICY users_update_own_profile_safe
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT g.role FROM public._my_profile_guard() AS g)
  AND is_master_admin = (SELECT g.is_master_admin FROM public._my_profile_guard() AS g)
  AND COALESCE(is_suspended, false) = (SELECT g.is_suspended FROM public._my_profile_guard() AS g)
  AND COALESCE(account_status::text, '') = COALESCE((SELECT g.account_status FROM public._my_profile_guard() AS g), '')
);

CREATE OR REPLACE FUNCTION public.prevent_self_grant_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id
     AND NOT public.is_admin_user()
     AND (
       NEW.is_premium IS DISTINCT FROM OLD.is_premium
       OR NEW.premium_expires_at IS DISTINCT FROM OLD.premium_expires_at
       OR NEW.premium_granted_at IS DISTINCT FROM OLD.premium_granted_at
       OR NEW.premium_granted_by IS DISTINCT FROM OLD.premium_granted_by
       OR NEW.premium_source IS DISTINCT FROM OLD.premium_source
       OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     )
  THEN
    RAISE EXCEPTION 'Protected profile privileges cannot be changed directly';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_self_grant_profile_privileges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_self_grant_profile_privileges() TO service_role;

DROP TRIGGER IF EXISTS prevent_self_grant_profile_privileges ON public.user_profiles;
CREATE TRIGGER prevent_self_grant_profile_privileges
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_grant_profile_privileges();

DROP FUNCTION IF EXISTS public._my_profile_privilege_guard();