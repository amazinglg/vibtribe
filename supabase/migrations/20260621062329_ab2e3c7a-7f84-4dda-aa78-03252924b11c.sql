-- Remove permissive public SELECT on app_releases (forces clients to use app_releases_public view)
DROP POLICY IF EXISTS "Public can read release version columns" ON public.app_releases;

-- Remove app_releases from realtime publication so admin-only columns (note, released_by) aren't broadcast
ALTER PUBLICATION supabase_realtime DROP TABLE public.app_releases;