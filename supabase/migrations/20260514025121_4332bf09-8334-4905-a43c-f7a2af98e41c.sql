CREATE OR REPLACE FUNCTION public.mark_messages_read(_chat_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.messages
  SET message_status = 'read'
  WHERE chat_id = _chat_id
    AND sender_id <> auth.uid()
    AND message_status <> 'read'
    AND public.is_chat_participant(_chat_id);
$$;

GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated;