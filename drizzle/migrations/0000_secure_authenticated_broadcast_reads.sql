CREATE OR REPLACE FUNCTION public.is_authenticated_broadcast_reader()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.is_authenticated_broadcast_reader() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authenticated_broadcast_reader() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_authenticated_broadcast_reader() TO service_role;

DROP POLICY IF EXISTS "Anyone authenticated can view broadcasts" ON public.broadcast_messages;
CREATE POLICY "Authenticated users can view broadcasts"
  ON public.broadcast_messages
  FOR SELECT
  TO authenticated
  USING (public.is_authenticated_broadcast_reader());

DROP POLICY IF EXISTS "Anyone authenticated can view reactions" ON public.broadcast_reactions;
CREATE POLICY "Authenticated users can view reactions"
  ON public.broadcast_reactions
  FOR SELECT
  TO authenticated
  USING (public.is_authenticated_broadcast_reader());