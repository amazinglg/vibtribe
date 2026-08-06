
CREATE TABLE IF NOT EXISTS sms_gw.gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  secret_hash text NOT NULL,
  label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  last_seen_at timestamptz,
  revoked_at timestamptz
);

ALTER TABLE sms_gw.gateways ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sms_gw.gateways FROM PUBLIC, anon, authenticated;

-- Register a device. Called only from trusted server code (service_role).
CREATE OR REPLACE FUNCTION sms_gw.register_gateway(_device_id text, _secret_hash text, _label text, _created_by uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sms_gw','public'
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO sms_gw.gateways (device_id, secret_hash, label, created_by)
  VALUES (_device_id, _secret_hash, coalesce(_label,''), _created_by)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'device_id', _device_id);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'device_exists');
END;
$$;

-- Authentication lookup: returns status + secret hash for a device.
CREATE OR REPLACE FUNCTION sms_gw.get_gateway_auth(_device_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'sms_gw','public'
AS $$
  SELECT jsonb_build_object('found', true, 'status', g.status, 'secret_hash', g.secret_hash)
  FROM sms_gw.gateways g WHERE g.device_id = _device_id;
$$;

CREATE OR REPLACE FUNCTION sms_gw.touch_gateway(_device_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'sms_gw','public'
AS $$
  UPDATE sms_gw.gateways SET last_seen_at = now() WHERE device_id = _device_id;
$$;

-- Listing never returns the secret hash.
CREATE OR REPLACE FUNCTION sms_gw.list_gateways()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'sms_gw','public'
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'device_id', g.device_id, 'label', g.label, 'status', g.status,
    'created_at', g.created_at, 'last_seen_at', g.last_seen_at
  ) ORDER BY g.created_at DESC), '[]'::jsonb)
  FROM sms_gw.gateways g;
$$;

CREATE OR REPLACE FUNCTION sms_gw.set_gateway_status(_device_id text, _status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sms_gw','public'
AS $$
BEGIN
  IF _status NOT IN ('active','revoked') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;
  UPDATE sms_gw.gateways
     SET status = _status,
         revoked_at = CASE WHEN _status = 'revoked' THEN now() ELSE NULL END
   WHERE device_id = _device_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Public-schema RPC wrappers, callable by service_role only.
CREATE OR REPLACE FUNCTION public.sms_gw_register_gateway(_device_id text, _secret_hash text, _label text, _created_by uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','sms_gw'
AS $$ SELECT sms_gw.register_gateway(_device_id, _secret_hash, _label, _created_by); $$;

CREATE OR REPLACE FUNCTION public.sms_gw_get_gateway_auth(_device_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','sms_gw'
AS $$ SELECT sms_gw.get_gateway_auth(_device_id); $$;

CREATE OR REPLACE FUNCTION public.sms_gw_touch_gateway(_device_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','sms_gw'
AS $$ SELECT sms_gw.touch_gateway(_device_id); $$;

CREATE OR REPLACE FUNCTION public.sms_gw_list_gateways()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','sms_gw'
AS $$ SELECT sms_gw.list_gateways(); $$;

CREATE OR REPLACE FUNCTION public.sms_gw_set_gateway_status(_device_id text, _status text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','sms_gw'
AS $$ SELECT sms_gw.set_gateway_status(_device_id, _status); $$;

REVOKE ALL ON FUNCTION public.sms_gw_register_gateway(text,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sms_gw_get_gateway_auth(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sms_gw_touch_gateway(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sms_gw_list_gateways() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sms_gw_set_gateway_status(text,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sms_gw_register_gateway(text,text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sms_gw_get_gateway_auth(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sms_gw_touch_gateway(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sms_gw_list_gateways() TO service_role;
GRANT EXECUTE ON FUNCTION public.sms_gw_set_gateway_status(text,text) TO service_role;
