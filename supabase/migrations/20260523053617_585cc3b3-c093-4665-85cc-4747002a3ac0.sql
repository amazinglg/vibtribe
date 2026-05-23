
-- 1. Attach role-change guard triggers to user_profiles (functions already exist)
DROP TRIGGER IF EXISTS trg_guard_role_changes ON public.user_profiles;
CREATE TRIGGER trg_guard_role_changes
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_role_changes();

DROP TRIGGER IF EXISTS trg_protect_master_admin ON public.user_profiles;
CREATE TRIGGER trg_protect_master_admin
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_master_admin();

-- 2. Restrict profile-photos bucket write policies to authenticated users only
DROP POLICY IF EXISTS "Users can upload own profile photo" ON storage.objects;
CREATE POLICY "Users can upload own profile photo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own profile photo" ON storage.objects;
CREATE POLICY "Users can update own profile photo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own profile photo" ON storage.objects;
CREATE POLICY "Users can delete own profile photo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
