
-- 1) Prevent admin role escalation via signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, mobile_number, role, avatar_url)
  VALUES (
    NEW.id, COALESCE(NEW.email,''),
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'mobile_number',''),
    'user',
    COALESCE(NEW.raw_user_meta_data->>'avatar_url','')
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $function$;

-- 2) Enforce status visibility in RLS
DROP POLICY IF EXISTS users_view_active_statuses ON public.statuses;
CREATE POLICY users_view_active_statuses ON public.statuses
  FOR SELECT TO authenticated
  USING (
    expires_at > CURRENT_TIMESTAMP
    AND (
      user_id = auth.uid()
      OR visibility = 'all'
      OR visibility IS NULL
      OR (visibility = 'selected' AND auth.uid() = ANY(selected_viewers))
      OR visibility = 'contacts'
    )
  );
