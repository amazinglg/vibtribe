-- Remove OTP + audit trail columns from any `authenticated` SELECT.
-- These are only consumed by SECURITY DEFINER functions (verify_guardian_email_otp,
-- record_guardian_consent, revoke_guardian_consent) which run as service-side code,
-- so nothing in the client depends on reading them directly.
REVOKE SELECT (
  email_otp_hash,
  email_otp_expires_at,
  email_otp_attempts,
  ip,
  user_agent
) ON public.guardian_consents FROM authenticated;

-- Explicit owner self-read policy for the minor. The client should keep using
-- get_my_guardian_status() (masked email/mobile, no OTP hash), but adding this
-- policy removes the inconsistency where a minor had zero SELECT rights on
-- their own record.
DROP POLICY IF EXISTS "Minors can view their own guardian consent" ON public.guardian_consents;
CREATE POLICY "Minors can view their own guardian consent"
  ON public.guardian_consents
  FOR SELECT
  TO authenticated
  USING (minor_user_id = auth.uid());
