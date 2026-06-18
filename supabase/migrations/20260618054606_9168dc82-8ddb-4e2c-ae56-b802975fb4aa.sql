
-- Realtime channel authorization. realtime.messages drives broadcast/presence
-- topic access. postgres_changes is gated by the underlying table RLS already.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_can_read_authorized_topics ON realtime.messages;
DROP POLICY IF EXISTS authenticated_can_send_authorized_topics ON realtime.messages;

CREATE POLICY authenticated_can_read_authorized_topics
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Must be signed in
  auth.uid() IS NOT NULL
  AND (
    -- Chat-scoped topics: "chat:<uuid>" — only chat participants
    CASE
      WHEN realtime.topic() LIKE 'chat:%' THEN
        public.is_chat_participant(
          NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
        )
      -- User-scoped topics: "user:<uuid>" — only the owning user
      WHEN realtime.topic() LIKE 'user:%' THEN
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid = auth.uid()
      -- All other topics: allow any authenticated user (used by
      -- postgres_changes, which is independently gated by table RLS).
      ELSE true
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
      ELSE true
    END
  )
);
