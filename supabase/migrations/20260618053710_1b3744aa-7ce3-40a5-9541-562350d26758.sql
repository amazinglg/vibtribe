
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;

-- Backfill: anyone who previously accepted the combined T&C also accepted privacy at that time.
UPDATE public.user_profiles
   SET privacy_accepted_at = terms_accepted_at
 WHERE privacy_accepted_at IS NULL
   AND terms_accepted_at IS NOT NULL;

-- Allow authenticated users to read the new column (matches other public-readable consent flags).
GRANT SELECT (privacy_accepted_at) ON public.user_profiles TO authenticated;

-- Update existing acceptance RPC to record BOTH.
CREATE OR REPLACE FUNCTION public.accept_terms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.user_profiles
     SET terms_accepted_at   = COALESCE(terms_accepted_at, now()),
         privacy_accepted_at = COALESCE(privacy_accepted_at, now())
   WHERE id = auth.uid();
END;
$function$;

-- Explicit RPC mirroring the action name used in the UI.
CREATE OR REPLACE FUNCTION public.accept_privacy_and_terms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.user_profiles
     SET terms_accepted_at   = COALESCE(terms_accepted_at, now()),
         privacy_accepted_at = COALESCE(privacy_accepted_at, now())
   WHERE id = auth.uid();
END;
$function$;
