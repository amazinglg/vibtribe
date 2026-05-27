DROP POLICY IF EXISTS users_update_own_profile_safe ON public.user_profiles;

CREATE POLICY users_update_own_profile_safe ON public.user_profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT up.role FROM public.user_profiles up WHERE up.id = auth.uid())
  AND is_master_admin = (SELECT up.is_master_admin FROM public.user_profiles up WHERE up.id = auth.uid())
  AND is_suspended IS NOT DISTINCT FROM (SELECT up.is_suspended FROM public.user_profiles up WHERE up.id = auth.uid())
  AND account_status IS NOT DISTINCT FROM (SELECT up.account_status FROM public.user_profiles up WHERE up.id = auth.uid())
);