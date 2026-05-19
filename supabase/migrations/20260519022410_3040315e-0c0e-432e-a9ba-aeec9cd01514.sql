CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_id),
  CHECK (user_id <> contact_id)
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_contacts" ON public.contacts;
CREATE POLICY "users_manage_own_contacts"
ON public.contacts
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_id ON public.contacts(contact_id);

CREATE OR REPLACE FUNCTION public.is_contact(_owner_id uuid, _viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.user_id = _viewer_id
      AND c.contact_id = _owner_id
  )
$$;

DROP POLICY IF EXISTS "users_view_active_statuses" ON public.statuses;
CREATE POLICY "users_view_active_statuses"
ON public.statuses
FOR SELECT
TO authenticated
USING (
  expires_at > now()
  AND (
    user_id = auth.uid()
    OR visibility IS NULL
    OR visibility = 'all'
    OR (visibility = 'contacts' AND public.is_contact(user_id, auth.uid()))
    OR (visibility = 'selected' AND auth.uid() = ANY(selected_viewers))
  )
);

CREATE OR REPLACE FUNCTION public.cleanup_expired_statuses_for_user()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.statuses
  WHERE expires_at <= now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;