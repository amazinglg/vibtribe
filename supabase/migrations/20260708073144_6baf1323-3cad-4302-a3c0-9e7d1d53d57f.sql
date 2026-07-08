
CREATE OR REPLACE FUNCTION public.delete_message_for_everyone(_msg_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sender uuid;
  _created timestamptz;
  _is_premium boolean := false;
  _is_master boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT sender_id, created_at INTO _sender, _created FROM public.messages WHERE id = _msg_id;
  IF _sender IS NULL THEN RETURN; END IF;
  IF _sender <> auth.uid() THEN
    RAISE EXCEPTION 'Only the sender can delete for everyone';
  END IF;

  SELECT COALESCE(is_master_admin, false),
         COALESCE(is_premium, false)
             AND (premium_expires_at IS NULL OR premium_expires_at > now())
    INTO _is_master, _is_premium
    FROM public.user_profiles
   WHERE id = auth.uid();

  IF NOT (_is_master OR _is_premium) AND _created < now() - interval '1 hour' THEN
    RAISE EXCEPTION 'Delete-for-everyone is only allowed within 1 hour of sending';
  END IF;

  UPDATE public.messages
    SET deleted_for_everyone = true,
        content = '__deleted_for_everyone__'
    WHERE id = _msg_id;
END;
$function$;

UPDATE public.user_profiles
   SET is_premium = true,
       premium_expires_at = NULL
 WHERE is_master_admin = true
   AND (is_premium = false OR premium_expires_at IS NOT NULL);

CREATE OR REPLACE FUNCTION public.auto_premium_master()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.is_master_admin, false) = true THEN
    NEW.is_premium := true;
    NEW.premium_expires_at := NULL;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS auto_premium_master_trg ON public.user_profiles;
CREATE TRIGGER auto_premium_master_trg
BEFORE INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_premium_master();

DROP FUNCTION IF EXISTS public.expire_premium_users();
CREATE FUNCTION public.expire_premium_users()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.user_profiles
     SET is_premium = false,
         premium_expires_at = NULL
   WHERE is_premium = true
     AND COALESCE(is_master_admin, false) = false
     AND premium_expires_at IS NOT NULL
     AND premium_expires_at < now();
END $function$;
