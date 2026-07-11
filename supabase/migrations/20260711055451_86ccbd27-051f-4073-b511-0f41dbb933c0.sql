-- Add missing admin-management permission keys used by newer admin pages.
INSERT INTO public.permission_keys (key, label, category, sort_order, description) VALUES
  ('reports.view',   'View reports',      'Moderation', 10, 'Open and review Trust & Safety reports'),
  ('reports.manage', 'Decide reports',    'Moderation', 20, 'Record moderation decisions and enforcement actions'),
  ('appeals.view',   'View appeals',      'Moderation', 30, 'Open and review moderation appeals'),
  ('appeals.manage', 'Decide appeals',    'Moderation', 40, 'Approve or reject moderation appeals'),
  ('legal.reminder', 'Send policy reminders', 'Marketing', 50, 'Send Terms and Privacy acceptance reminders')
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label,
      category = EXCLUDED.category,
      sort_order = EXCLUDED.sort_order,
      description = EXCLUDED.description;

-- Seed sensible defaults only where no explicit role assignment exists yet.
INSERT INTO public.role_permissions (role_key, permission_key, allowed, updated_at)
SELECT ar.key, pk.key, true, now()
FROM public.app_roles ar
JOIN public.permission_keys pk ON pk.key IN (
  'reports.view','reports.manage','appeals.view','appeals.manage','legal.reminder'
)
WHERE ar.key = 'admin'
ON CONFLICT (role_key, permission_key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key, allowed, updated_at)
SELECT ar.key, pk.key, true, now()
FROM public.app_roles ar
JOIN public.permission_keys pk ON pk.key IN (
  'reports.view','reports.manage','appeals.view','appeals.manage','legal.reminder'
)
WHERE ar.key = 'master_admin'
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Update report access policies so permission toggles actually affect report pages.
DROP POLICY IF EXISTS "Reporter or master reads reports" ON public.content_reports;
DROP POLICY IF EXISTS "Master admin updates reports" ON public.content_reports;
DROP POLICY IF EXISTS "Master admin deletes reports" ON public.content_reports;

CREATE POLICY "Reporter or permitted admins read reports"
  ON public.content_reports FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR public.has_permission(auth.uid(), 'reports.view')
    OR public.has_permission(auth.uid(), 'reports.manage')
  );

CREATE POLICY "Permitted admins update reports"
  ON public.content_reports FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'reports.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'reports.manage'));

CREATE POLICY "Permitted admins delete reports"
  ON public.content_reports FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'reports.manage'));

-- Update appeal access policies so permission toggles affect appeal pages.
DROP POLICY IF EXISTS "Master admins can read all appeals" ON public.report_appeals;
DROP POLICY IF EXISTS "Master admins can update appeals" ON public.report_appeals;

CREATE POLICY "Permitted admins can read all appeals"
  ON public.report_appeals FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'appeals.view')
    OR public.has_permission(auth.uid(), 'appeals.manage')
  );

CREATE POLICY "Permitted admins can update appeals"
  ON public.report_appeals FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'appeals.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'appeals.manage'));

-- Premium RPCs now respect the permission matrix. Master admins still pass through public.has_permission().
CREATE OR REPLACE FUNCTION public.admin_set_premium(
  _user_id uuid,
  _months int,
  _forever boolean DEFAULT false
)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.user_profiles;
  new_expiry timestamptz;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'premium.manage') THEN
    RAISE EXCEPTION 'Premium management permission required';
  END IF;

  IF _forever THEN
    new_expiry := NULL;
  ELSE
    IF _months NOT IN (1,3,6,12) THEN
      RAISE EXCEPTION 'Months must be 1, 3, 6 or 12 (or use forever=true)';
    END IF;
    new_expiry := now() + make_interval(months => _months);
  END IF;

  UPDATE public.user_profiles
     SET is_premium = true,
         premium_expires_at = new_expiry,
         premium_granted_at = now(),
         premium_granted_by = auth.uid(),
         premium_source = CASE WHEN _forever THEN 'forever' ELSE 'manual' END
   WHERE id = _user_id
  RETURNING * INTO r;

  IF r.id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  r.totp_secret := NULL; r.totp_pending_secret := NULL;
  r.encrypted_private_key := NULL; r.key_salt := NULL; r.key_iv := NULL;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_premium(_user_id uuid)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.user_profiles;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'premium.manage') THEN
    RAISE EXCEPTION 'Premium management permission required';
  END IF;

  UPDATE public.user_profiles
     SET is_premium = false,
         premium_expires_at = NULL,
         premium_source = NULL
   WHERE id = _user_id
  RETURNING * INTO r;

  IF r.id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  r.totp_secret := NULL; r.totp_pending_secret := NULL;
  r.encrypted_private_key := NULL; r.key_salt := NULL; r.key_iv := NULL;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_premium_users()
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  real_email text,
  mobile_number text,
  country_code text,
  avatar_url text,
  is_premium boolean,
  premium_expires_at timestamptz,
  premium_granted_at timestamptz,
  premium_source text,
  premium_granted_by uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_permission(auth.uid(), 'premium.view') OR public.has_permission(auth.uid(), 'premium.manage')) THEN
    RAISE EXCEPTION 'Premium view permission required';
  END IF;

  RETURN QUERY
    SELECT p.id, p.full_name, p.username, p.real_email, p.mobile_number,
           p.country_code, p.avatar_url, p.is_premium, p.premium_expires_at,
           p.premium_granted_at, p.premium_source, p.premium_granted_by, p.created_at
      FROM public.user_profiles p
     WHERE p.is_premium = true
     ORDER BY p.premium_granted_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_premium(uuid,int,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revoke_premium(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_premium_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_premium(uuid,int,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_premium(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_premium_users() TO authenticated;