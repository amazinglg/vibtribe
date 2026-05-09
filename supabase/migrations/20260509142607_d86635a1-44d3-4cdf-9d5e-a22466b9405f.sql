-- Add is_master_admin column
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_master_admin boolean NOT NULL DEFAULT false;

-- Mark all currently-existing admins as master admin (preserve original owner)
UPDATE public.user_profiles SET is_master_admin = true WHERE role = 'admin';

-- Helper: is current user master admin?
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_master_admin = true
  )
$$;

-- Trigger: prevent non-master admins from changing the master admin's row,
-- and prevent anyone from changing the is_master_admin flag.
CREATE OR REPLACE FUNCTION public.protect_master_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Never allow changing is_master_admin via API
  IF NEW.is_master_admin IS DISTINCT FROM OLD.is_master_admin THEN
    RAISE EXCEPTION 'Cannot modify is_master_admin flag';
  END IF;

  -- If target row is a master admin and the actor is not the master admin themself, block any change
  IF OLD.is_master_admin = true AND auth.uid() IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Master admin cannot be modified by other users';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_master_admin_trg ON public.user_profiles;
CREATE TRIGGER protect_master_admin_trg
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_master_admin();
