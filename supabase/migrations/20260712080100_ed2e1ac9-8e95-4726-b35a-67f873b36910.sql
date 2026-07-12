GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

CREATE OR REPLACE FUNCTION public.claim_push_subscription(
  _endpoint text,
  _p256dh text,
  _auth text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF coalesce(_endpoint, '') = '' OR coalesce(_p256dh, '') = '' OR coalesce(_auth, '') = '' THEN
    RAISE EXCEPTION 'Invalid push subscription' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
  VALUES (_uid, _endpoint, _p256dh, _auth, now())
  ON CONFLICT (endpoint) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_subscription(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_push_subscription(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_push_subscription(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_subscription(text, text, text) TO service_role;