
-- 1) Reliable tribe creation via SECURITY DEFINER (fixes RLS insert failure)
CREATE OR REPLACE FUNCTION public.create_tribe(_name text, _member_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _chat_id uuid;
  _mid uuid;
  _clean_name text := btrim(coalesce(_name, ''));
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF length(_clean_name) = 0 THEN
    RAISE EXCEPTION 'Tribe name is required';
  END IF;

  INSERT INTO public.chats (is_group, name, chat_type, created_by, participant_one, disappear_mode)
  VALUES (true, _clean_name, 'normal', _uid, _uid, '24h')
  RETURNING id INTO _chat_id;

  -- Creator as leader (trigger already handles this, keep idempotent)
  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (_chat_id, _uid, 'leader')
  ON CONFLICT DO NOTHING;

  IF _member_ids IS NOT NULL THEN
    FOREACH _mid IN ARRAY _member_ids LOOP
      IF _mid IS NOT NULL AND _mid <> _uid THEN
        INSERT INTO public.chat_members (chat_id, user_id)
        VALUES (_chat_id, _mid)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN _chat_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tribe(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tribe(text, uuid[]) TO authenticated;

-- 2) Status likes
CREATE TABLE IF NOT EXISTS public.status_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  liker_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_id, liker_id)
);

CREATE INDEX IF NOT EXISTS idx_status_likes_status ON public.status_likes(status_id);
CREATE INDEX IF NOT EXISTS idx_status_likes_liker  ON public.status_likes(liker_id);

GRANT SELECT, INSERT, DELETE ON public.status_likes TO authenticated;
GRANT ALL ON public.status_likes TO service_role;

ALTER TABLE public.status_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_or_liker_reads_likes"
  ON public.status_likes FOR SELECT
  TO authenticated
  USING (
    liker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.statuses s
      WHERE s.id = status_likes.status_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "liker_inserts_own_like"
  ON public.status_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    liker_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.statuses s
      WHERE s.id = status_likes.status_id
        AND s.expires_at > now()
    )
  );

CREATE POLICY "liker_deletes_own_like"
  ON public.status_likes FOR DELETE
  TO authenticated
  USING (liker_id = auth.uid());
