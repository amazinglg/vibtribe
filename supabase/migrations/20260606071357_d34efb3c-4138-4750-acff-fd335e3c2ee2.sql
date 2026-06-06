
-- 1. Lock down OTP functions (account takeover fix)
REVOKE EXECUTE ON FUNCTION public.issue_email_otp(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_email_otp(text,text,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reset_password_with_otp(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_password_with_otp(text,text,text) TO service_role;

-- 2. Lock down email enumeration RPC
REVOKE EXECUTE ON FUNCTION public.is_real_email_available(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_real_email_available(text) TO service_role;

-- 3. Tighten chat_members insert: users can only insert themselves.
--    Adding others is handled by members_insert_by_leader (leaders/admins only).
--    Public tribe joining uses tribe_join_public (SECURITY DEFINER), unaffected.
DROP POLICY IF EXISTS members_insert ON public.chat_members;
CREATE POLICY members_insert ON public.chat_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4. Allow requester to withdraw and leaders/admins to clean up join requests
CREATE POLICY tribe_join_requests_delete ON public.tribe_join_requests
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_tribe_leader(chat_id, auth.uid())
    OR public.is_admin_user()
  );
