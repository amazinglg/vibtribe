-- Cleanup of unused columns from the removed dual secure-chat feature.
-- The new model uses the user_secure_chats table only.

ALTER TABLE public.chats
  DROP COLUMN IF EXISTS parent_chat_id,
  DROP COLUMN IF EXISTS is_secure,
  DROP COLUMN IF EXISTS secure_code,
  DROP COLUMN IF EXISTS secure_code_hash;

ALTER TABLE public.messages
  DROP COLUMN IF EXISTS sent_secure;

-- Drop indexes that referenced removed columns (safe if missing)
DROP INDEX IF EXISTS public.idx_chats_secure_code;