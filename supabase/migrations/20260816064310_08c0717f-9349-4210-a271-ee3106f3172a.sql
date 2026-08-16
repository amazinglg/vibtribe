-- Restrict content_reports reads to moderators only; reporters get a safe, limited view via RPC.
DROP POLICY IF EXISTS "Reporter or permitted admins read reports" ON public.content_reports;

CREATE POLICY "Permitted admins read reports"
ON public.content_reports
FOR SELECT
TO authenticated
USING (
  has_permission(auth.uid(), 'reports.view'::text)
  OR has_permission(auth.uid(), 'reports.manage'::text)
);

CREATE OR REPLACE FUNCTION public.get_my_report_status(_report_id uuid)
RETURNS TABLE (
  id uuid,
  report_type text,
  reason text,
  status text,
  action_taken text,
  moderated_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id,
         r.report_type::text,
         r.reason::text,
         r.status::text,
         r.action_taken,
         r.moderated_at,
         r.created_at
  FROM public.content_reports r
  WHERE r.id = _report_id
    AND r.reporter_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_report_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_report_status(uuid) TO authenticated;