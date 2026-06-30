
-- 1) Fill in missing permission descriptions
UPDATE public.permission_keys SET description = CASE key
  WHEN 'releases.view'    THEN 'View app releases and download history'
  WHEN 'releases.publish' THEN 'Publish a new app release (APK upload)'
  WHEN 'releases.delete'  THEN 'Delete an existing release'
  WHEN 'roles.view'       THEN 'View roles and their assigned permissions'
  WHEN 'roles.manage'     THEN 'Create, edit and delete custom roles'
  WHEN 'analytics.view'   THEN 'View analytics dashboards and engagement metrics'
  WHEN 'audit.view'       THEN 'View audit logs of admin actions'
  WHEN 'storage.view'     THEN 'Browse uploaded files in storage buckets'
  WHEN 'storage.delete'   THEN 'Permanently delete files from storage'
  ELSE description
END
WHERE key IN ('releases.view','releases.publish','releases.delete','roles.view','roles.manage','analytics.view','audit.view','storage.view','storage.delete');

-- 2) Premium permission keys
INSERT INTO public.permission_keys (key, label, description, category) VALUES
  ('premium.view',   'View premium users',  'See the list of premium subscribers', 'Premium'),
  ('premium.manage', 'Manage premium',      'Grant or revoke premium status for any user', 'Premium')
ON CONFLICT (key) DO NOTHING;

-- 3) Premium columns on user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS premium_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS premium_granted_by uuid,
  ADD COLUMN IF NOT EXISTS premium_source text;

-- Column-level grant: peers/self may see whether someone is premium (for badges)
GRANT SELECT (is_premium, premium_expires_at) ON public.user_profiles TO authenticated;

CREATE INDEX IF NOT EXISTS idx_user_profiles_premium
  ON public.user_profiles (is_premium, premium_expires_at)
  WHERE is_premium = true;

-- 4) Admin function: mark a user premium for N months or forever
CREATE OR REPLACE FUNCTION public.admin_set_premium(
  _user_id uuid,
  _months int,           -- 1, 3, 6, 12 ; ignored when _forever is true
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
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Master admin access required';
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

  -- Sanitize sensitive cols
  r.totp_secret := NULL; r.totp_pending_secret := NULL;
  r.encrypted_private_key := NULL; r.key_salt := NULL; r.key_iv := NULL;
  RETURN r;
END;
$$;

-- 5) Admin function: revoke premium immediately
CREATE OR REPLACE FUNCTION public.admin_revoke_premium(_user_id uuid)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.user_profiles;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Master admin access required';
  END IF;
  UPDATE public.user_profiles
     SET is_premium = false,
         premium_expires_at = NULL,
         premium_source = NULL
   WHERE id = _user_id
  RETURNING * INTO r;
  r.totp_secret := NULL; r.totp_pending_secret := NULL;
  r.encrypted_private_key := NULL; r.key_salt := NULL; r.key_iv := NULL;
  RETURN r;
END;
$$;

-- 6) Admin function: list all current premium users
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
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
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

REVOKE ALL ON FUNCTION public.admin_set_premium(uuid,int,boolean)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revoke_premium(uuid)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_premium_users()            FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_premium(uuid,int,boolean)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_premium(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_premium_users()            TO authenticated;

-- 7) Daily auto-expiry job (idempotent)
CREATE OR REPLACE FUNCTION public.expire_premium_users()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.user_profiles
     SET is_premium = false,
         premium_source = NULL
   WHERE is_premium = true
     AND premium_expires_at IS NOT NULL
     AND premium_expires_at < now();
$$;

-- Unschedule a previous run if it exists, then (re)schedule
SELECT cron.unschedule('expire-premium-users') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-premium-users'
);
SELECT cron.schedule(
  'expire-premium-users',
  '17 * * * *',  -- hourly at :17 — cheap, catches expiries within the hour
  $$ SELECT public.expire_premium_users(); $$
);
