-- =====================================================================
-- 1. app_releases: hide internal columns from non-admin users
-- =====================================================================
REVOKE SELECT (note, released_by) ON public.app_releases FROM authenticated;
REVOKE SELECT (note, released_by) ON public.app_releases FROM anon;
-- service_role retains full access automatically.

-- =====================================================================
-- 2. user_profiles: revoke column-level SELECT on sensitive fields
--    from regular (anon/authenticated) roles. Owners read their own
--    sensitive fields via existing SECURITY DEFINER RPCs
--    (get_my_full_profile, get_my_totp_secret, get_my_encryption_material).
--    Admins continue to access these via admin_* RPCs / service_role.
-- =====================================================================
DO $$
DECLARE
  _col text;
  _cols text[] := ARRAY[
    'real_email',
    'dob',
    'country_code',
    'marketing_consent_ip',
    'totp_secret',
    'totp_pending_secret',
    'encrypted_private_key',
    'key_salt',
    'key_iv',
    'login_attempts',
    'is_suspended',
    'account_status'
  ];
BEGIN
  FOREACH _col IN ARRAY _cols LOOP
    -- Guard each column so the migration is safe on environments where a
    -- column might not exist.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = _col
    ) THEN
      EXECUTE format('REVOKE SELECT (%I) ON public.user_profiles FROM authenticated', _col);
      EXECUTE format('REVOKE SELECT (%I) ON public.user_profiles FROM anon', _col);
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- 3. user_secure_chats: store the unlock code as a one-way hash and
--    route reads/writes through SECURITY DEFINER RPCs.
-- =====================================================================

-- 3a. Add hashed column.
ALTER TABLE public.user_secure_chats
  ADD COLUMN IF NOT EXISTS code_hash text;

-- 3b. Backfill: hash any existing plaintext codes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_secure_chats' AND column_name='code'
  ) THEN
    EXECUTE $sql$
      UPDATE public.user_secure_chats
         SET code_hash = extensions.crypt(code, extensions.gen_salt('bf'))
       WHERE code_hash IS NULL AND code IS NOT NULL
    $sql$;
  END IF;
END $$;

-- 3c. Drop the plaintext column + its index.
DROP INDEX IF EXISTS public.idx_user_secure_chats_code;
ALTER TABLE public.user_secure_chats DROP COLUMN IF EXISTS code;

-- 3d. The owner-only RLS policy still applies; the hash is only useful
--     to the secure RPCs below, so revoke direct column SELECT.
REVOKE SELECT (code_hash) ON public.user_secure_chats FROM authenticated;
REVOKE SELECT (code_hash) ON public.user_secure_chats FROM anon;

-- 3e. RPC: hash + upsert an unlock code for a chat owned by the caller.
CREATE OR REPLACE FUNCTION public.mark_secure_chat(_chat_id uuid, _code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _code IS NULL OR length(trim(_code)) < 4 THEN
    RAISE EXCEPTION 'Unlock code must be at least 4 characters';
  END IF;
  IF NOT public.is_chat_participant(_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a participant of this chat';
  END IF;

  _hash := extensions.crypt(_code, extensions.gen_salt('bf'));

  INSERT INTO public.user_secure_chats (user_id, chat_id, code_hash)
  VALUES (auth.uid(), _chat_id, _hash)
  ON CONFLICT (user_id, chat_id) DO UPDATE SET code_hash = EXCLUDED.code_hash;
END;
$$;

-- 3f. RPC: return the chat_id whose hashed code matches the supplied code
--     for the calling user. Returns NULL when no match.
CREATE OR REPLACE FUNCTION public.find_secure_chat_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _chat uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT chat_id INTO _chat
    FROM public.user_secure_chats
   WHERE user_id = auth.uid()
     AND code_hash IS NOT NULL
     AND code_hash = extensions.crypt(_code, code_hash)
   LIMIT 1;

  RETURN _chat;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_secure_chat(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_secure_chat_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_secure_chat(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_secure_chat_by_code(text) TO authenticated;

-- Ensure the unique constraint required by the upsert exists. Older
-- environments may have used a different name; add it idempotently.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.user_secure_chats'::regclass
       AND contype = 'u'
       AND conname = 'user_secure_chats_user_chat_unique'
  ) THEN
    BEGIN
      ALTER TABLE public.user_secure_chats
        ADD CONSTRAINT user_secure_chats_user_chat_unique UNIQUE (user_id, chat_id);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;