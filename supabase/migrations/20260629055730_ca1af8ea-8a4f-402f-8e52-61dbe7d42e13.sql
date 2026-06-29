
CREATE TABLE IF NOT EXISTS public.consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('terms','privacy')),
  policy_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_log_user_idx ON public.consent_log(user_id, consent_type, accepted_at DESC);

GRANT SELECT ON public.consent_log TO authenticated;
GRANT ALL ON public.consent_log TO service_role;

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own consent log"
  ON public.consent_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- SECURITY DEFINER writer so the client can log without needing INSERT grants.
CREATE OR REPLACE FUNCTION public.record_consent(
  _consent_type text,
  _policy_version text,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _consent_type NOT IN ('terms','privacy') THEN
    RAISE EXCEPTION 'invalid consent_type';
  END IF;

  INSERT INTO public.consent_log (user_id, consent_type, policy_version, ip, user_agent)
  VALUES (auth.uid(), _consent_type, _policy_version, _ip, _user_agent)
  RETURNING id INTO _id;

  IF _consent_type = 'terms' THEN
    UPDATE public.user_profiles SET terms_accepted_at = now() WHERE id = auth.uid();
  ELSE
    UPDATE public.user_profiles SET privacy_accepted_at = now() WHERE id = auth.uid();
  END IF;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_consent(text, text, text, text) TO authenticated;
