CREATE OR REPLACE FUNCTION public.sms_gw_create_claim(_user_id uuid, _token_hash text, _gateway_id text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, sms_gw
AS $$ SELECT sms_gw.create_phone_claim(_user_id, _token_hash, _gateway_id); $$;

CREATE OR REPLACE FUNCTION public.sms_gw_consume_token(
  _gateway_id text, _sms_id text, _token_hash text, _token_fingerprint text,
  _from_msisdn text, _received_at timestamptz)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, sms_gw
AS $$ SELECT sms_gw.consume_gateway_token(_gateway_id, _sms_id, _token_hash, _token_fingerprint, _from_msisdn, _received_at); $$;

CREATE OR REPLACE FUNCTION public.sms_gw_register_nonce(_gateway_id text, _nonce text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public, sms_gw
AS $$ SELECT sms_gw.register_gateway_nonce(_gateway_id, _nonce); $$;

CREATE OR REPLACE FUNCTION public.sms_gw_phone_status(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, sms_gw
AS $$ SELECT sms_gw.get_phone_status(_user_id); $$;

REVOKE ALL ON FUNCTION public.sms_gw_create_claim(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sms_gw_consume_token(text, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sms_gw_register_nonce(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sms_gw_phone_status(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sms_gw_create_claim(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sms_gw_consume_token(text, text, text, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.sms_gw_register_nonce(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sms_gw_phone_status(uuid) TO service_role;