
DROP POLICY IF EXISTS admin_update_any_profile ON public.user_profiles;
DROP POLICY IF EXISTS admin_manage_all_profiles ON public.user_profiles;

-- Admins can read every row.
CREATE POLICY admin_select_all_profiles
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- Admins can update any row, but role / is_master_admin can only be
-- changed when the caller is the master admin (defense in depth on top
-- of the existing guard_role_changes / protect_master_admin triggers).
CREATE POLICY admin_update_any_profile
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (
    public.is_admin_user()
    AND (
      public.is_master_admin()
      OR (
        role = (SELECT role FROM public.user_profiles WHERE id = user_profiles.id)
        AND is_master_admin = (SELECT is_master_admin FROM public.user_profiles WHERE id = user_profiles.id)
      )
    )
  );

-- Admins can delete (existing capability, kept).
CREATE POLICY admin_delete_any_profile
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());
