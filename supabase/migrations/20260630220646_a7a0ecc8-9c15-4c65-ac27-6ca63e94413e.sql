
-- Helper SECURITY DEFINER functions to avoid recursive RLS subqueries on user_profiles
CREATE OR REPLACE FUNCTION public._my_profile_guard()
RETURNS TABLE(role text, is_master_admin boolean, is_suspended boolean, account_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT up.role, COALESCE(up.is_master_admin,false), COALESCE(up.is_suspended,false), up.account_status::text
  FROM public.user_profiles up
  WHERE up.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public._profile_guard(_id uuid)
RETURNS TABLE(role text, is_master_admin boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT up.role, COALESCE(up.is_master_admin,false)
  FROM public.user_profiles up
  WHERE up.id = _id
$$;

REVOKE ALL ON FUNCTION public._my_profile_guard() FROM public;
REVOKE ALL ON FUNCTION public._profile_guard(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public._my_profile_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public._profile_guard(uuid) TO authenticated;

-- Replace recursive WITH CHECK policies
DROP POLICY IF EXISTS users_update_own_profile_safe ON public.user_profiles;
CREATE POLICY users_update_own_profile_safe ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role         = (SELECT g.role            FROM public._my_profile_guard() g)
    AND is_master_admin = (SELECT g.is_master_admin FROM public._my_profile_guard() g)
    AND COALESCE(is_suspended,false)  = (SELECT g.is_suspended    FROM public._my_profile_guard() g)
    AND COALESCE(account_status::text,'') = COALESCE((SELECT g.account_status FROM public._my_profile_guard() g),'')
  );

DROP POLICY IF EXISTS admin_update_any_profile ON public.user_profiles;
CREATE POLICY admin_update_any_profile ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (is_admin_user())
  WITH CHECK (
    is_admin_user()
    AND (
      is_master_admin()
      OR (
        role = (SELECT g.role FROM public._profile_guard(user_profiles.id) g)
        AND is_master_admin = (SELECT g.is_master_admin FROM public._profile_guard(user_profiles.id) g)
      )
    )
  );
