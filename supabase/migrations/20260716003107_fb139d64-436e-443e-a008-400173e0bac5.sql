CREATE OR REPLACE FUNCTION public.tribe_delete(_chat_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_master boolean;
  v_is_founder boolean;
  v_is_group boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(c.is_group, false), (c.created_by = auth.uid())
    INTO v_is_group, v_is_founder
  FROM public.chats c
  WHERE c.id = _chat_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tribe not found';
  END IF;

  IF NOT v_is_group THEN
    RAISE EXCEPTION 'Not a tribe';
  END IF;

  SELECT COALESCE(up.is_master_admin, false) INTO v_is_master
  FROM public.user_profiles up
  WHERE up.id = auth.uid();

  IF NOT (v_is_founder OR COALESCE(v_is_master, false)) THEN
    RAISE EXCEPTION 'Only the tribe founder or master admin can delete this tribe';
  END IF;

  BEGIN DELETE FROM public.tribe_invites WHERE chat_id = _chat_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.tribe_join_requests WHERE chat_id = _chat_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.chat_mutes WHERE chat_id = _chat_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.user_secure_chats WHERE chat_id = _chat_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.calls WHERE chat_id = _chat_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.notifications WHERE (payload->>'chat_id') = _chat_id::text; EXCEPTION WHEN others THEN NULL; END;

  DELETE FROM public.chats WHERE id = _chat_id;
END;
$function$;