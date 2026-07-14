
-- Admin permanently deletes a deleted-users audit entry
CREATE OR REPLACE FUNCTION public.admin_delete_deleted_user_log(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Only master admin can delete deleted-user records';
  END IF;
  DELETE FROM public.deleted_users_log WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_deleted_user_log(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_deleted_user_log(uuid) TO authenticated;

-- Admin permanently deletes a reviewed report (and its appeals + audit log)
CREATE OR REPLACE FUNCTION public.admin_delete_report(_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT (public.has_permission(auth.uid(), 'reports.manage') OR public.is_master_admin()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT status INTO v_status FROM public.content_reports WHERE id = _report_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Report not found';
  END IF;
  IF v_status = 'pending' THEN
    RAISE EXCEPTION 'Cannot delete a pending report — review it first';
  END IF;

  DELETE FROM public.report_appeals WHERE report_id = _report_id;
  DELETE FROM public.moderation_audit_log WHERE report_id = _report_id;
  DELETE FROM public.content_reports WHERE id = _report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_report(uuid) TO authenticated;
