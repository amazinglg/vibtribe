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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF coalesce(length(trim(_endpoint)), 0) = 0
     OR coalesce(length(trim(_p256dh)), 0) = 0
     OR coalesce(length(trim(_auth)), 0) = 0 THEN
    RAISE EXCEPTION 'Invalid push subscription';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
  VALUES (auth.uid(), _endpoint, _p256dh, _auth, now())
  ON CONFLICT (endpoint) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_subscription(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_push_subscription(text, text, text) TO authenticated;