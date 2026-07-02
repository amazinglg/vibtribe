
-- 1) guardian_consents: drop minor SELECT, add safe-projection RPC
DROP POLICY IF EXISTS "Minor can view own guardian consents" ON public.guardian_consents;

CREATE OR REPLACE FUNCTION public.get_my_guardian_status()
RETURNS TABLE(
  id uuid,
  guardian_name text,
  guardian_email_masked text,
  guardian_mobile_masked text,
  relationship text,
  email_verified_at timestamptz,
  consented_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gc.id,
         gc.guardian_name,
         CASE WHEN gc.guardian_email IS NULL OR gc.guardian_email = '' THEN NULL
              ELSE regexp_replace(split_part(gc.guardian_email,'@',1), '(?<=.).(?=.*.)', '*', 'g')
                   || '@' || split_part(gc.guardian_email,'@',2) END,
         CASE WHEN gc.guardian_mobile IS NULL OR length(gc.guardian_mobile) < 4 THEN NULL
              ELSE repeat('*', greatest(length(gc.guardian_mobile) - 4, 0)) || right(gc.guardian_mobile, 4) END,
         gc.relationship,
         gc.email_verified_at,
         gc.consented_at,
         gc.revoked_at,
         gc.created_at,
         gc.updated_at
    FROM public.guardian_consents gc
   WHERE gc.minor_user_id = auth.uid()
     AND gc.graduated_at IS NULL
   ORDER BY gc.created_at DESC
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_guardian_status() TO authenticated;

-- Companion RPC used right after OTP verification to get the guardian consent_token
-- and full guardian_email needed to actually email the consent request. Only returns
-- the row for the caller's own minor account and never exposes OTP hash / IP / UA.
CREATE OR REPLACE FUNCTION public.get_my_guardian_send_target()
RETURNS TABLE(
  id uuid,
  guardian_name text,
  guardian_email text,
  relationship text,
  consent_token text,
  consented_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gc.id, gc.guardian_name, gc.guardian_email, gc.relationship,
         gc.consent_token, gc.consented_at
    FROM public.guardian_consents gc
   WHERE gc.minor_user_id = auth.uid()
     AND gc.revoked_at IS NULL
     AND gc.graduated_at IS NULL
   ORDER BY gc.created_at DESC
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_guardian_send_target() TO authenticated;

-- 2) user_profiles: revoke mobile_hash from authenticated
-- (all other sensitive columns are already blocked by column-level ACLs; mobile_hash
-- is only needed by server-side contact-matching RPCs).
REVOKE SELECT (mobile_hash) ON public.user_profiles FROM authenticated;

-- 3) chat-media broadcast upload path traversal: reject empty second segment.
DROP POLICY IF EXISTS "Users upload own chat media" ON storage.objects;
CREATE POLICY "Users upload own chat media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND (storage.foldername(name))[2] IS NOT NULL
    AND (storage.foldername(name))[2] <> ''
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    AND public.is_chat_participant(((storage.foldername(name))[2])::uuid)
    AND POSITION('..' IN name) = 0
  );

DROP POLICY IF EXISTS "Participants read chat media" ON storage.objects;
CREATE POLICY "Participants read chat media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[2] IS NOT NULL
    AND (storage.foldername(name))[2] <> ''
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    AND public.is_chat_participant(((storage.foldername(name))[2])::uuid)
  );

-- 4) age_years: set search_path to lock it down.
CREATE OR REPLACE FUNCTION public.age_years(_dob date)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN _dob IS NULL THEN NULL ELSE date_part('year', age(_dob))::int END;
$$;
