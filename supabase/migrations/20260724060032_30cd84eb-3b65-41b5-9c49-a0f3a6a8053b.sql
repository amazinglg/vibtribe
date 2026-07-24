
CREATE OR REPLACE FUNCTION public.delete_my_account(
  _reason_key TEXT DEFAULT 'unspecified',
  _reason_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  v_email TEXT; v_real_email TEXT; v_mobile TEXT; v_country TEXT;
  v_full_name TEXT; v_mobile_hash TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT email, real_email, mobile_number, country_code, full_name, mobile_hash
    INTO v_email, v_real_email, v_mobile, v_country, v_full_name, v_mobile_hash
    FROM public.user_profiles WHERE id = uid;
  IF v_mobile_hash IS NULL AND v_mobile IS NOT NULL THEN
    v_mobile_hash := public.compute_mobile_hash(v_mobile);
  END IF;

  INSERT INTO public.deleted_users_log (
    original_user_id, full_name, email, mobile_number, country_code, mobile_hash,
    initiated_by, initiator_id, reason_key, reason_text, terms_breach
  ) VALUES (
    uid, v_full_name, COALESCE(v_real_email, v_email), v_mobile, v_country, v_mobile_hash,
    'user', uid, _reason_key, _reason_text, false
  );

  BEGIN
    DELETE FROM storage.objects
      WHERE bucket_id IN ('profile-photos','status-media')
        AND (split_part(name, '/', 1) = uid::text OR owner = uid);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  DELETE FROM public.status_views WHERE viewer_id = uid;
  DELETE FROM public.status_views WHERE status_id IN (SELECT id FROM public.statuses WHERE user_id = uid);
  DELETE FROM public.statuses WHERE user_id = uid;
  DELETE FROM public.contacts WHERE user_id = uid OR contact_id = uid;
  DELETE FROM public.messages WHERE sender_id = uid;
  DELETE FROM public.messages WHERE chat_id IN (
    SELECT id FROM public.chats WHERE participant_one = uid OR participant_two = uid OR created_by = uid
  );
  DELETE FROM public.chat_members WHERE user_id = uid;
  DELETE FROM public.chat_members WHERE chat_id IN (
    SELECT id FROM public.chats WHERE participant_one = uid OR participant_two = uid OR created_by = uid
  );
  DELETE FROM public.chats WHERE participant_one = uid OR participant_two = uid OR created_by = uid;
  DELETE FROM public.calls WHERE caller_id = uid OR callee_id = uid;
  DELETE FROM public.blocked_users WHERE blocker_id = uid OR blocked_user_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid OR related_user_id = uid;
  DELETE FROM public.push_subscriptions WHERE user_id = uid;
  DELETE FROM public.support_tickets WHERE user_id = uid;
  DELETE FROM public.force_logout_tokens WHERE user_id = uid OR issued_by = uid;
  DELETE FROM public.user_profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_my_account(TEXT, TEXT) TO authenticated;

CREATE POLICY "chats_master_admin_read"
  ON public.chats FOR SELECT TO authenticated
  USING (public.is_master_admin());

CREATE POLICY "chat_members_master_admin_read"
  ON public.chat_members FOR SELECT TO authenticated
  USING (public.is_master_admin());

CREATE POLICY "tribe_invites_master_admin_read"
  ON public.tribe_invites FOR SELECT TO authenticated
  USING (public.is_master_admin());

CREATE POLICY "tribe_join_requests_master_admin_read"
  ON public.tribe_join_requests FOR SELECT TO authenticated
  USING (public.is_master_admin());
