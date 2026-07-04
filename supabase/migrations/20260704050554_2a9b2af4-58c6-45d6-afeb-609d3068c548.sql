-- Allowlist columns for "Specific Users" visibility
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS profile_photo_allowed_viewers uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status_allowed_viewers uuid[] NOT NULL DEFAULT '{}';

-- Owner-side permission function (SECURITY DEFINER so viewers don't need read on
-- the owner's contacts / allowlist)
CREATE OR REPLACE FUNCTION public.can_view_profile_photo(_owner uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _owner IS NULL OR _viewer IS NULL THEN false
    WHEN _owner = _viewer THEN true
    ELSE COALESCE((
      SELECT CASE COALESCE(up.profile_photo_visibility, 'all')
        WHEN 'all' THEN true
        WHEN 'contacts' THEN public.is_contact(_owner, _viewer)
        WHEN 'selected' THEN _viewer = ANY(COALESCE(up.profile_photo_allowed_viewers, '{}'::uuid[]))
        ELSE true
      END
      FROM public.user_profiles up
      WHERE up.id = _owner
    ), true)
  END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_profile_photo(uuid, uuid) TO authenticated;

-- Batch helper: returns effective avatar_url for a list of owner IDs from the
-- caller's viewpoint. Hidden avatars come back as NULL.
CREATE OR REPLACE FUNCTION public.visible_avatar_urls(_owner_ids uuid[])
RETURNS TABLE (id uuid, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id,
         CASE WHEN public.can_view_profile_photo(up.id, auth.uid())
              THEN up.avatar_url ELSE NULL END AS avatar_url
  FROM public.user_profiles up
  WHERE up.id = ANY(COALESCE(_owner_ids, '{}'::uuid[]));
$$;

GRANT EXECUTE ON FUNCTION public.visible_avatar_urls(uuid[]) TO authenticated;
