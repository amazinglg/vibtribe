CREATE OR REPLACE FUNCTION public._my_profile_privilege_guard()
RETURNS TABLE (
  role text,
  is_master_admin boolean,
  is_suspended boolean,
  account_status text,
  is_premium boolean,
  premium_expires_at timestamptz,
  premium_granted_at timestamptz,
  premium_granted_by uuid,
  premium_source text,
  is_verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    up.role,
    COALESCE(up.is_master_admin, false),
    COALESCE(up.is_suspended, false),
    up.account_status::text,
    COALESCE(up.is_premium, false),
    up.premium_expires_at,
    up.premium_granted_at,
    up.premium_granted_by,
    up.premium_source,
    COALESCE(up.is_verified, false)
  FROM public.user_profiles AS up
  WHERE up.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public._my_profile_privilege_guard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._my_profile_privilege_guard() TO authenticated, service_role;

DROP POLICY IF EXISTS users_update_own_profile_safe ON public.user_profiles;
CREATE POLICY users_update_own_profile_safe
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role IS NOT DISTINCT FROM (SELECT g.role FROM public._my_profile_privilege_guard() AS g)
  AND is_master_admin IS NOT DISTINCT FROM (SELECT g.is_master_admin FROM public._my_profile_privilege_guard() AS g)
  AND COALESCE(is_suspended, false) IS NOT DISTINCT FROM (SELECT g.is_suspended FROM public._my_profile_privilege_guard() AS g)
  AND account_status::text IS NOT DISTINCT FROM (SELECT g.account_status FROM public._my_profile_privilege_guard() AS g)
  AND COALESCE(is_premium, false) IS NOT DISTINCT FROM (SELECT g.is_premium FROM public._my_profile_privilege_guard() AS g)
  AND premium_expires_at IS NOT DISTINCT FROM (SELECT g.premium_expires_at FROM public._my_profile_privilege_guard() AS g)
  AND premium_granted_at IS NOT DISTINCT FROM (SELECT g.premium_granted_at FROM public._my_profile_privilege_guard() AS g)
  AND premium_granted_by IS NOT DISTINCT FROM (SELECT g.premium_granted_by FROM public._my_profile_privilege_guard() AS g)
  AND premium_source IS NOT DISTINCT FROM (SELECT g.premium_source FROM public._my_profile_privilege_guard() AS g)
  AND COALESCE(is_verified, false) IS NOT DISTINCT FROM (SELECT g.is_verified FROM public._my_profile_privilege_guard() AS g)
);