-- Helper: can the current viewer see ANY active status owned by _owner_id under the visibility rules?
CREATE OR REPLACE FUNCTION public.can_view_status_owner(_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.statuses s
    WHERE s.user_id = _owner_id
      AND s.expires_at > now()
      AND (
        s.user_id = auth.uid()
        OR s.visibility IS NULL
        OR s.visibility = 'all'
        OR (s.visibility = 'contacts' AND public.is_contact(s.user_id, auth.uid()))
        OR (s.visibility = 'selected' AND auth.uid() = ANY (s.selected_viewers))
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_view_status_owner(uuid) TO authenticated;

-- Replace the over-broad SELECT policy with one that enforces status visibility.
DROP POLICY IF EXISTS status_media_authenticated_read ON storage.objects;

CREATE POLICY status_media_visibility_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'status-media'
  AND (
    -- Owner can always read their own folder
    (storage.foldername(name))[1] = (auth.uid())::text
    -- Otherwise must be allowed by the statuses visibility rules
    OR public.can_view_status_owner(((storage.foldername(name))[1])::uuid)
  )
);