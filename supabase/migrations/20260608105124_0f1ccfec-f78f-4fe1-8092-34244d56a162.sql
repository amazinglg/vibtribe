
-- =====================================================================
-- Security hardening migration
-- 1) app-downloads bucket: admin-only RLS policies
-- 2) user_profiles: revoke remaining sensitive columns from authenticated
-- 3) Realtime publication: drop tables that the client does NOT subscribe to
-- =====================================================================

-- ---------- 1) app-downloads bucket: admin-only access -------------------
DROP POLICY IF EXISTS "app_downloads_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "app_downloads_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "app_downloads_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "app_downloads_admin_delete" ON storage.objects;

CREATE POLICY "app_downloads_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'app-downloads' AND public.is_admin_user());

CREATE POLICY "app_downloads_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-downloads' AND public.is_admin_user());

CREATE POLICY "app_downloads_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'app-downloads' AND public.is_admin_user())
  WITH CHECK (bucket_id = 'app-downloads' AND public.is_admin_user());

CREATE POLICY "app_downloads_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'app-downloads' AND public.is_admin_user());

-- ---------- 2) user_profiles: tighten remaining sensitive columns --------
-- Column-level grants already restrict email, real_email, dob, key material,
-- login_attempts, marketing_consent_*, notif_*, pref_*, terms_accepted_at,
-- email_marketing_opt_in. The remaining over-exposed columns are
-- is_suspended and account_status. Admin pages read these via the
-- security-definer RPCs (admin_list_user_profiles, admin_get_user_profile),
-- which bypass column grants, so revoking is safe.
REVOKE SELECT (is_suspended)    ON public.user_profiles FROM authenticated;
REVOKE SELECT (account_status)  ON public.user_profiles FROM authenticated;

-- Re-document the blanket-row SELECT policy: row visibility is intentional
-- (the app needs to look up other users by id for chat/contacts/calls), but
-- column-level grants restrict which columns are actually returned. Replace
-- the policy with a clearer name and explicit comment so future scans and
-- reviewers understand the model.
DROP POLICY IF EXISTS "users_view_all_profiles" ON public.user_profiles;
CREATE POLICY "users_view_other_profiles_safe_columns"
  ON public.user_profiles
  FOR SELECT TO authenticated
  USING (true);
COMMENT ON POLICY "users_view_other_profiles_safe_columns" ON public.user_profiles IS
  'Row visibility is intentional so authenticated users can resolve other users for chat, contacts, search and calls. Sensitive columns (email, real_email, dob, key material, login_attempts, is_suspended, account_status, marketing/notification/pref columns, terms_accepted_at) are NOT granted to the authenticated role at column level — only id, full_name, mobile_number, username, bio, avatar_url, role, is_online, last_seen, profile_completed, public_key, app_theme, country_code, is_master_admin, profile_photo_visibility, status_visibility, key_setup_completed are readable.';

-- ---------- 3) Realtime publication: reduce blast radius -----------------
-- The browser client only subscribes to: messages, chats, broadcast_messages,
-- broadcast_reactions, calls, user_secure_chats (already not in pub),
-- notifications (not in pub), app_releases (not in pub). It does NOT
-- subscribe to chat_members, tribe_invites or tribe_join_requests, so
-- those table streams should not be on the wire.
ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_members;
ALTER PUBLICATION supabase_realtime DROP TABLE public.tribe_invites;
ALTER PUBLICATION supabase_realtime DROP TABLE public.tribe_join_requests;
