-- Allow master admin to legitimately grant/revoke master admin on any account,
-- while still blocking everyone else (including regular admins) from touching it.
CREATE OR REPLACE FUNCTION public.protect_master_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_is_master boolean;
BEGIN
  IF NEW.is_master_admin IS DISTINCT FROM OLD.is_master_admin THEN
    SELECT COALESCE(is_master_admin, false) INTO actor_is_master
      FROM public.user_profiles WHERE id = auth.uid();
    IF NOT COALESCE(actor_is_master, false) THEN
      RAISE EXCEPTION 'Only the master admin can change the master admin flag';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Tighten role-change guard: only the master admin (not regular admins)
-- may change another user's role.
CREATE OR REPLACE FUNCTION public.guard_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_is_master boolean;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    SELECT COALESCE(is_master_admin, false) INTO actor_is_master
      FROM public.user_profiles WHERE id = auth.uid();
    IF NOT COALESCE(actor_is_master, false) THEN
      RAISE EXCEPTION 'Only the master admin can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop the duplicate trigger so only one guard fires per UPDATE.
DROP TRIGGER IF EXISTS protect_master_admin_trg ON public.user_profiles;

-- Replace the broad self-update policy with one that excludes role/master-admin
-- columns. The triggers are the authoritative gate, but tightening the policy
-- closes the column-level write path the scanner flags.
DROP POLICY IF EXISTS users_manage_own_profile ON public.user_profiles;

-- Owners can read/insert/delete their own row freely.
CREATE POLICY users_select_own_profile ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY users_insert_own_profile ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY users_delete_own_profile ON public.user_profiles
  FOR DELETE TO authenticated
  USING (id = auth.uid());

-- Owners may UPDATE their own row, but ONLY if role and is_master_admin
-- are unchanged. The triggers above still block any sneaky path that
-- bypasses the policy check.
CREATE POLICY users_update_own_profile_safe ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.user_profiles WHERE id = auth.uid())
    AND is_master_admin = (SELECT is_master_admin FROM public.user_profiles WHERE id = auth.uid())
  );

-- Restrict the admin update policy to true admins only (no implicit self-update path).
DROP POLICY IF EXISTS admin_update_any_profile ON public.user_profiles;
CREATE POLICY admin_update_any_profile ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());