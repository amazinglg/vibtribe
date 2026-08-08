CREATE OR REPLACE FUNCTION public.sms_gw_delete_gateway(_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, sms_gw
AS $$
DECLARE v_count int;
BEGIN
  BEGIN
    DELETE FROM sms_gw.gateway_nonces WHERE gateway_id = _device_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  DELETE FROM sms_gw.gateways WHERE device_id = _device_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_device');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.sms_gw_delete_gateway(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_gw_delete_gateway(text) TO service_role;