-- Restrictive INSERT policy for data_export_requests: user can only queue their own,
-- and delivered_to_email must be NULL at insert time (only the server function may
-- populate it later using the account email from auth.users).
DROP POLICY IF EXISTS "Users create own export requests" ON public.data_export_requests;
CREATE POLICY "Users create own export requests"
ON public.data_export_requests
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND delivered_to_email IS NULL
);