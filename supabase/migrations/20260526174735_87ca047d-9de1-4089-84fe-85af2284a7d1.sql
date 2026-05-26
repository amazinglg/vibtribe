CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- NOTE: storage objects are removed via the Storage API in the server function
  -- that calls this RPC; direct deletes from storage.objects are blocked.

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
$function$;