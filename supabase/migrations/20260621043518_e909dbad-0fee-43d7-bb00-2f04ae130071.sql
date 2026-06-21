
-- Tighten realtime.messages authorization: scope call signaling topics to
-- participants and deny unknown topics by default.
DROP POLICY IF EXISTS authenticated_can_read_authorized_topics ON realtime.messages;
DROP POLICY IF EXISTS authenticated_can_send_authorized_topics ON realtime.messages;

CREATE POLICY authenticated_can_read_authorized_topics
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    CASE
      WHEN realtime.topic() LIKE 'chat:%' THEN
        public.is_chat_participant(
          NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
        )
      WHEN realtime.topic() LIKE 'user:%' THEN
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid = auth.uid()
      WHEN realtime.topic() LIKE 'incoming-calls:%' THEN
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid = auth.uid()
      WHEN realtime.topic() LIKE 'call:%' OR realtime.topic() LIKE 'call-status:%' THEN
        EXISTS (
          SELECT 1 FROM public.calls c
          WHERE c.id = NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
            AND (c.caller_id = auth.uid() OR c.callee_id = auth.uid())
        )
      ELSE false
    END
  )
);

CREATE POLICY authenticated_can_send_authorized_topics
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    CASE
      WHEN realtime.topic() LIKE 'chat:%' THEN
        public.is_chat_participant(
          NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
        )
      WHEN realtime.topic() LIKE 'user:%' THEN
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid = auth.uid()
      WHEN realtime.topic() LIKE 'incoming-calls:%' THEN
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid = auth.uid()
      WHEN realtime.topic() LIKE 'call:%' OR realtime.topic() LIKE 'call-status:%' THEN
        EXISTS (
          SELECT 1 FROM public.calls c
          WHERE c.id = NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
            AND (c.caller_id = auth.uid() OR c.callee_id = auth.uid())
        )
      ELSE false
    END
  )
);
