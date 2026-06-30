-- Phase D: Inactive-account retention + versioned consent re-prompts

-- 1) Retention warning timestamps on user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS inactivity_warning_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS inactivity_final_warning_sent_at timestamptz;

-- 2) RPC to read the user's most-recent accepted versions per consent type.
--    Used by the Terms/Privacy gate to detect when a new policy version
--    requires a re-prompt (DPDP §6(6) "demonstrable consent" for each version).
CREATE OR REPLACE FUNCTION public.get_my_latest_consent_versions()
RETURNS TABLE(consent_type text, policy_version text, accepted_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (cl.consent_type)
    cl.consent_type, cl.policy_version, cl.accepted_at
  FROM public.consent_log cl
  WHERE cl.user_id = auth.uid()
    AND cl.withdrawn_at IS NULL
  ORDER BY cl.consent_type, cl.accepted_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_latest_consent_versions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_latest_consent_versions() TO authenticated;
