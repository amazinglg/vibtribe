-- 1) Tighten Realtime topic authorization: deny everything not explicitly allowed.
DROP POLICY IF EXISTS authenticated_can_read_authorized_topics ON realtime.messages;
CREATE POLICY authenticated_can_read_authorized_topics
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND CASE
    WHEN realtime.topic() LIKE 'chat:%'
      THEN public.is_chat_participant(NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid)
    WHEN realtime.topic() LIKE 'user:%'
      THEN NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid = auth.uid()
    ELSE false
  END
);

DROP POLICY IF EXISTS authenticated_can_send_authorized_topics ON realtime.messages;
CREATE POLICY authenticated_can_send_authorized_topics
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND CASE
    WHEN realtime.topic() LIKE 'chat:%'
      THEN public.is_chat_participant(NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid)
    WHEN realtime.topic() LIKE 'user:%'
      THEN NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid = auth.uid()
    ELSE false
  END
);

-- 2) Revoke peer access to sensitive user_profiles columns.
-- Owner self-reads of these columns now go through the get_my_full_profile() SECURITY DEFINER RPC.
-- Admin reads continue through admin_list_user_profiles() / admin_get_user_profile().
-- Server code uses the service-role client and is unaffected.
REVOKE SELECT (
  email,
  dob,
  account_status,
  is_suspended,
  terms_accepted_at,
  privacy_accepted_at,
  terms_warning_sent_at,
  email_marketing_opt_in,
  marketing_consent_at,
  marketing_consent_source
) ON public.user_profiles FROM authenticated;