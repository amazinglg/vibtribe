
-- Rewrite self-delete to also remove contacts, status_views, and storage files
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Storage objects owned by this user (profile photos + status media live under a folder = user id)
  DELETE FROM storage.objects
    WHERE bucket_id IN ('profile-photos','status-media')
      AND (split_part(name, '/', 1) = uid::text OR owner = uid);

  -- Status views authored by user, then statuses they own
  DELETE FROM public.status_views WHERE viewer_id = uid;
  DELETE FROM public.status_views WHERE status_id IN (SELECT id FROM public.statuses WHERE user_id = uid);
  DELETE FROM public.statuses WHERE user_id = uid;

  -- Contacts (both directions)
  DELETE FROM public.contacts WHERE user_id = uid OR contact_id = uid;

  -- Messaging
  DELETE FROM public.messages WHERE sender_id = uid;
  DELETE FROM public.messages WHERE chat_id IN (
    SELECT id FROM public.chats WHERE participant_one = uid OR participant_two = uid OR created_by = uid
  );
  DELETE FROM public.chat_members WHERE user_id = uid;
  DELETE FROM public.chat_members WHERE chat_id IN (
    SELECT id FROM public.chats WHERE participant_one = uid OR participant_two = uid OR created_by = uid
  );
  DELETE FROM public.chats WHERE participant_one = uid OR participant_two = uid OR created_by = uid;

  -- Calls, blocks, notifications, push, tickets, force-logout
  DELETE FROM public.calls WHERE caller_id = uid OR callee_id = uid;
  DELETE FROM public.blocked_users WHERE blocker_id = uid OR blocked_user_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid OR related_user_id = uid;
  DELETE FROM public.push_subscriptions WHERE user_id = uid;
  DELETE FROM public.support_tickets WHERE user_id = uid;
  DELETE FROM public.force_logout_tokens WHERE user_id = uid OR issued_by = uid;

  -- Profile + auth
  DELETE FROM public.user_profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- Admin-driven full purge
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE target_is_master boolean;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Use delete_my_account to delete your own account';
  END IF;
  SELECT COALESCE(is_master_admin, false) INTO target_is_master
    FROM public.user_profiles WHERE id = _user_id;
  IF COALESCE(target_is_master, false) THEN
    RAISE EXCEPTION 'Cannot delete the master admin account';
  END IF;

  DELETE FROM storage.objects
    WHERE bucket_id IN ('profile-photos','status-media')
      AND (split_part(name, '/', 1) = _user_id::text OR owner = _user_id);

  DELETE FROM public.status_views WHERE viewer_id = _user_id;
  DELETE FROM public.status_views WHERE status_id IN (SELECT id FROM public.statuses WHERE user_id = _user_id);
  DELETE FROM public.statuses WHERE user_id = _user_id;

  DELETE FROM public.contacts WHERE user_id = _user_id OR contact_id = _user_id;

  DELETE FROM public.messages WHERE sender_id = _user_id;
  DELETE FROM public.messages WHERE chat_id IN (
    SELECT id FROM public.chats WHERE participant_one = _user_id OR participant_two = _user_id OR created_by = _user_id
  );
  DELETE FROM public.chat_members WHERE user_id = _user_id;
  DELETE FROM public.chat_members WHERE chat_id IN (
    SELECT id FROM public.chats WHERE participant_one = _user_id OR participant_two = _user_id OR created_by = _user_id
  );
  DELETE FROM public.chats WHERE participant_one = _user_id OR participant_two = _user_id OR created_by = _user_id;

  DELETE FROM public.calls WHERE caller_id = _user_id OR callee_id = _user_id;
  DELETE FROM public.blocked_users WHERE blocker_id = _user_id OR blocked_user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id OR related_user_id = _user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = _user_id;
  DELETE FROM public.support_tickets WHERE user_id = _user_id;
  DELETE FROM public.force_logout_tokens WHERE user_id = _user_id OR issued_by = _user_id;

  DELETE FROM public.user_profiles WHERE id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;
