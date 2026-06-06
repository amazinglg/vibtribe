-- Tighten chat handle enumeration: limit to public tribes only and restrict
-- columns at the app layer (we cannot easily column-restrict in RLS; switching
-- to public-only at least hides private tribes' metadata from non-members).
DROP POLICY IF EXISTS "chats_minimal_read_for_handle" ON public.chats;
CREATE POLICY "chats_minimal_read_for_handle" ON public.chats
  FOR SELECT TO authenticated
  USING (is_group = true AND handle IS NOT NULL AND privacy = 'public');

-- Allow master admins to delete recipient rows for data hygiene.
CREATE POLICY "master_delete_recipients" ON public.email_campaign_recipients
  FOR DELETE TO authenticated USING (public.is_master_admin());

-- Fix function search_path lint on the two pinned-master helpers.
CREATE OR REPLACE FUNCTION public.is_pinned_master_mobile(_mobile text)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(coalesce(_mobile,''), '\D', '', 'g') LIKE '%9826016419'
$$;