
CREATE TABLE IF NOT EXISTS public.status_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_status_views_status_id ON public.status_views(status_id);
CREATE INDEX IF NOT EXISTS idx_status_views_viewer_id ON public.status_views(viewer_id);

ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewer_inserts_own_view"
  ON public.status_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "owner_or_viewer_reads_views"
  ON public.status_views FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.statuses s WHERE s.id = status_id AND s.user_id = auth.uid())
  );

CREATE POLICY "viewer_deletes_own_view"
  ON public.status_views FOR DELETE TO authenticated
  USING (viewer_id = auth.uid());
