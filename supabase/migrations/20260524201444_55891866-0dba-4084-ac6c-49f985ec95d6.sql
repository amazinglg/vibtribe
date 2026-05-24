
-- Merge duplicate 1:1 chats for the same participant pair into the oldest one.
-- Messages from the duplicate(s) are moved into the canonical chat, preserving
-- their sent_secure flag so the lock icon still distinguishes them. Any per-user
-- "secure mode" marks are moved to the canonical chat as well, and the dup chats
-- are removed.

WITH pairs AS (
  SELECT
    id,
    LEAST(participant_one, participant_two)    AS u1,
    GREATEST(participant_one, participant_two) AS u2,
    created_at
  FROM chats
  WHERE is_group = false
    AND participant_one IS NOT NULL
    AND participant_two IS NOT NULL
),
ranked AS (
  SELECT id, u1, u2,
         FIRST_VALUE(id) OVER (PARTITION BY u1, u2 ORDER BY created_at ASC) AS canonical_id
  FROM pairs
),
dupes AS (
  SELECT id AS dup_id, canonical_id FROM ranked WHERE id <> canonical_id
)
UPDATE messages m
SET chat_id = d.canonical_id
FROM dupes d
WHERE m.chat_id = d.dup_id;

-- Move per-user secure marks for any dup chat onto the canonical chat
WITH pairs AS (
  SELECT id,
         LEAST(participant_one, participant_two)    AS u1,
         GREATEST(participant_one, participant_two) AS u2,
         created_at
  FROM chats
  WHERE is_group = false
    AND participant_one IS NOT NULL
    AND participant_two IS NOT NULL
),
ranked AS (
  SELECT id, u1, u2,
         FIRST_VALUE(id) OVER (PARTITION BY u1, u2 ORDER BY created_at ASC) AS canonical_id
  FROM pairs
),
dupes AS (
  SELECT id AS dup_id, canonical_id FROM ranked WHERE id <> canonical_id
)
INSERT INTO user_secure_chats (user_id, chat_id, code)
SELECT usc.user_id, d.canonical_id, usc.code
FROM user_secure_chats usc
JOIN dupes d ON d.dup_id = usc.chat_id
ON CONFLICT (user_id, chat_id) DO NOTHING;

-- Remove the duplicate chats (cascades to chat_members; user_secure_chats rows
-- referencing dup chats are removed explicitly first to avoid leaving orphans).
WITH pairs AS (
  SELECT id,
         LEAST(participant_one, participant_two)    AS u1,
         GREATEST(participant_one, participant_two) AS u2,
         created_at
  FROM chats
  WHERE is_group = false
    AND participant_one IS NOT NULL
    AND participant_two IS NOT NULL
),
ranked AS (
  SELECT id, u1, u2,
         FIRST_VALUE(id) OVER (PARTITION BY u1, u2 ORDER BY created_at ASC) AS canonical_id
  FROM pairs
),
dupes AS (
  SELECT id AS dup_id FROM ranked WHERE id <> canonical_id
)
DELETE FROM user_secure_chats WHERE chat_id IN (SELECT dup_id FROM dupes);

WITH pairs AS (
  SELECT id,
         LEAST(participant_one, participant_two)    AS u1,
         GREATEST(participant_one, participant_two) AS u2,
         created_at
  FROM chats
  WHERE is_group = false
    AND participant_one IS NOT NULL
    AND participant_two IS NOT NULL
),
ranked AS (
  SELECT id, u1, u2,
         FIRST_VALUE(id) OVER (PARTITION BY u1, u2 ORDER BY created_at ASC) AS canonical_id
  FROM pairs
),
dupes AS (
  SELECT id AS dup_id FROM ranked WHERE id <> canonical_id
)
DELETE FROM chats WHERE id IN (SELECT dup_id FROM dupes);

-- Add a unique index so we never end up with two 1:1 chats for the same pair
-- again. Uses sorted UUID pair to be order-independent.
CREATE UNIQUE INDEX IF NOT EXISTS chats_unique_one_to_one
  ON chats (LEAST(participant_one, participant_two), GREATEST(participant_one, participant_two))
  WHERE is_group = false
    AND participant_one IS NOT NULL
    AND participant_two IS NOT NULL;
