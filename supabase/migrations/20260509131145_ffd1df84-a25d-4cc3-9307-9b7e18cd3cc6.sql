
-- 1. Tighten statuses visibility: drop the 'contacts' fallback that exposed all users
DROP POLICY IF EXISTS users_view_active_statuses ON public.statuses;
CREATE POLICY users_view_active_statuses ON public.statuses
  FOR SELECT TO authenticated
  USING (
    expires_at > CURRENT_TIMESTAMP AND (
      user_id = auth.uid()
      OR visibility IS NULL
      OR visibility = 'all'
      OR (visibility = 'selected' AND auth.uid() = ANY (selected_viewers))
    )
  );

-- 2. Tighten support_tickets insert: prevent authenticated impersonation
DROP POLICY IF EXISTS anyone_can_create_ticket ON public.support_tickets;
CREATE POLICY anyone_can_create_ticket ON public.support_tickets
  FOR INSERT TO public
  WITH CHECK (
    -- Guests must leave user_id null; signed-in users may only set their own id
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
  );

-- 3. Lock down SECURITY DEFINER functions: revoke from anon/public, grant only where needed
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_message_expiry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_chat_participant(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.expire_seen_messages(uuid) FROM PUBLIC, anon;

-- 4. Create a working admin password reset RPC (replaces the silently-broken one)
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id uuid, new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Only admins can reset passwords';
  END IF;
  IF length(new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  UPDATE auth.users
    SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = target_user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) TO authenticated;
