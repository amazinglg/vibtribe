
CREATE POLICY "admins_read_marketing_banners" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'marketing-banners' AND public.is_admin_user());

CREATE POLICY "admins_insert_marketing_banners" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketing-banners' AND public.is_admin_user());

CREATE POLICY "admins_delete_marketing_banners" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'marketing-banners' AND public.is_admin_user());
