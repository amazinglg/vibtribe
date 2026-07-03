
-- Allow reading minimum profile info of a user you already share a 1:1 chat or tribe with.
-- Fixes chat header stuck on "Loading..." and false "hasn't enabled encryption" for
-- users who aren't in each other's contacts.
CREATE POLICY "users_select_chat_partner_profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE COALESCE(c.is_group, false) = false
        AND (
          (c.participant_one = auth.uid() AND c.participant_two = user_profiles.id)
          OR (c.participant_two = auth.uid() AND c.participant_one = user_profiles.id)
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.chat_members m1
      JOIN public.chat_members m2 ON m1.chat_id = m2.chat_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = user_profiles.id
    )
  );
