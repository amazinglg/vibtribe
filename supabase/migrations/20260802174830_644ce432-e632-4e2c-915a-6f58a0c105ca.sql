DROP POLICY IF EXISTS members_insert ON public.chat_members;

CREATE POLICY members_insert_self_public_tribe
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_members.chat_id
      AND c.is_group = true
      AND c.privacy = 'public'
  )
);