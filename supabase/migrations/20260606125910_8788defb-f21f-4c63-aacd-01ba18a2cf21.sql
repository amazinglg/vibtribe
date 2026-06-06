
-- ============ Pinned master admin (mobile 9826016419) ============
CREATE OR REPLACE FUNCTION public.is_pinned_master_mobile(_mobile text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(coalesce(_mobile,''), '\D', '', 'g') LIKE '%9826016419'
$$;

CREATE OR REPLACE FUNCTION public.protect_pinned_master()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_pinned_master_mobile(OLD.mobile_number) THEN
    IF NEW.is_master_admin IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'The pinned master admin cannot be demoted';
    END IF;
    IF NEW.role NOT IN ('admin','master_admin') THEN
      RAISE EXCEPTION 'The pinned master admin role cannot be changed';
    END IF;
    IF COALESCE(NEW.is_suspended, false) = true
       OR NEW.account_status::text IN ('suspended','blocked') THEN
      RAISE EXCEPTION 'The pinned master admin cannot be suspended or blocked';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_pinned_master ON public.user_profiles;
CREATE TRIGGER trg_protect_pinned_master
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_pinned_master();

CREATE OR REPLACE FUNCTION public.auto_pin_master()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_pinned_master_mobile(NEW.mobile_number) THEN
    NEW.is_master_admin := true;
    IF NEW.role IS NULL OR NEW.role = 'user' THEN
      NEW.role := 'admin';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_pin_master ON public.user_profiles;
CREATE TRIGGER trg_auto_pin_master
  BEFORE INSERT OR UPDATE OF mobile_number ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_pin_master();

-- Backfill: ensure the pinned account is already master admin.
-- Disable triggers temporarily so existing protect_master_admin doesn't block us.
DO $$
BEGIN
  EXECUTE 'SET LOCAL session_replication_role = replica';
  UPDATE public.user_profiles
     SET is_master_admin = true,
         role = 'admin',
         is_suspended = false,
         account_status = 'active'::user_status
   WHERE public.is_pinned_master_mobile(mobile_number);
END $$;

-- ============ Roles ============
CREATE TABLE IF NOT EXISTS public.app_roles (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_roles TO authenticated;
GRANT ALL ON public.app_roles TO service_role;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_app_roles" ON public.app_roles
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "master_writes_app_roles_ins" ON public.app_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_master_admin());
CREATE POLICY "master_writes_app_roles_upd" ON public.app_roles
  FOR UPDATE TO authenticated USING (public.is_master_admin()) WITH CHECK (public.is_master_admin());
CREATE POLICY "master_writes_app_roles_del" ON public.app_roles
  FOR DELETE TO authenticated USING (public.is_master_admin() AND is_system = false);

INSERT INTO public.app_roles (key, label, description, is_system) VALUES
  ('admin',     'Admin',     'Full administrative access', true),
  ('moderator', 'Moderator', 'Moderation of users and content', false),
  ('support',   'Support',   'Customer support access',        false)
ON CONFLICT (key) DO NOTHING;

-- ============ Permission keys (catalogue) ============
CREATE TABLE IF NOT EXISTS public.permission_keys (
  key text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.permission_keys TO authenticated;
GRANT ALL ON public.permission_keys TO service_role;
ALTER TABLE public.permission_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_permission_keys" ON public.permission_keys
  FOR SELECT TO authenticated USING (public.is_admin_user());

INSERT INTO public.permission_keys (key, label, category, description, sort_order) VALUES
  ('users.view',           'View users',           'Users',       'See user list and profiles', 10),
  ('users.edit',           'Edit users',           'Users',       'Edit user info',             20),
  ('users.suspend',        'Suspend users',        'Users',       'Suspend / unsuspend',        30),
  ('users.block',          'Block users',          'Users',       'Block / unblock',            40),
  ('users.delete',         'Delete users',         'Users',       'Permanently delete users',   50),
  ('users.reset_password', 'Reset passwords',      'Users',       'Reset user passwords',       60),
  ('users.force_logout',   'Force logout',         'Users',       'Force-sign-out users',       70),
  ('tribes.view',          'View tribes',          'Tribes',      'See all tribes',             10),
  ('tribes.delete',        'Delete tribes',        'Tribes',      'Delete any tribe',           20),
  ('support.view',         'View tickets',         'Support',     'See support tickets',        10),
  ('support.reply',        'Reply to tickets',     'Support',     'Reply to support tickets',   20),
  ('support.delete',       'Delete tickets',       'Support',     'Permanently delete tickets', 30),
  ('marketing.view',       'View marketing',       'Marketing',   'See marketing campaigns',    10),
  ('marketing.send',       'Send campaigns',       'Marketing',   'Send marketing campaigns',   20),
  ('marketing.delete',     'Delete campaigns',     'Marketing',   'Delete campaigns',           30),
  ('permissions.manage',   'Manage permissions',   'Permissions', 'Manage roles and permissions', 10)
ON CONFLICT (key) DO NOTHING;

-- ============ Role -> permission matrix ============
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_key text NOT NULL REFERENCES public.app_roles(key) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permission_keys(key) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (role_key, permission_key)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY "master_writes_role_permissions_ins" ON public.role_permissions
  FOR INSERT TO authenticated WITH CHECK (public.is_master_admin());
CREATE POLICY "master_writes_role_permissions_upd" ON public.role_permissions
  FOR UPDATE TO authenticated USING (public.is_master_admin()) WITH CHECK (public.is_master_admin());
CREATE POLICY "master_writes_role_permissions_del" ON public.role_permissions
  FOR DELETE TO authenticated USING (public.is_master_admin());

-- Seed: Admin role gets every permission.
INSERT INTO public.role_permissions (role_key, permission_key, allowed)
SELECT 'admin', key, true FROM public.permission_keys
ON CONFLICT DO NOTHING;

-- Helper: does a given user have a given permission?
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    -- Master admin always has every permission
    EXISTS (SELECT 1 FROM public.user_profiles
             WHERE id = _user_id AND is_master_admin = true)
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.role_permissions rp ON rp.role_key = up.role
      WHERE up.id = _user_id
        AND rp.permission_key = _permission_key
        AND rp.allowed = true
    )
$$;
