
-- Fix 1: two-arg is_chat_participant must also check chat_members (group chats)
CREATE OR REPLACE FUNCTION public.is_chat_participant(_chat_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = _chat_id
      AND (c.participant_one = _user_id OR c.participant_two = _user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.chat_members m
    WHERE m.chat_id = _chat_id AND m.user_id = _user_id
  );
$function$;

-- Fix 2: restrict app_settings SELECT - whitelist only safe public keys for general authenticated users
DROP POLICY IF EXISTS "app_settings authenticated read" ON public.app_settings;

CREATE POLICY "app_settings public keys readable"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key IN ('broadcast_avatar_url'));

CREATE POLICY "app_settings admin read all"
ON public.app_settings
FOR SELECT
TO authenticated
USING (public.is_admin_user());
