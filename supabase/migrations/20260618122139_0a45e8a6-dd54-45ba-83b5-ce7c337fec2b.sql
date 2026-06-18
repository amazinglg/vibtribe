
CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.trust_locks (
  chat_id uuid PRIMARY KEY REFERENCES public.chats(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trust_locks TO authenticated;
GRANT ALL ON public.trust_locks TO service_role;

ALTER TABLE public.trust_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_chat_participant(_chat_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = _chat_id
      AND (c.participant_one = _user_id OR c.participant_two = _user_id)
  );
$$;

DROP POLICY IF EXISTS "trust_locks_select_participants" ON public.trust_locks;
CREATE POLICY "trust_locks_select_participants"
  ON public.trust_locks
  FOR SELECT
  TO authenticated
  USING (public.is_chat_participant(chat_id, auth.uid()));

DROP POLICY IF EXISTS "trust_locks_insert_participants" ON public.trust_locks;
CREATE POLICY "trust_locks_insert_participants"
  ON public.trust_locks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_chat_participant(chat_id, auth.uid())
    AND owner_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "trust_locks_update_owner" ON public.trust_locks;
CREATE POLICY "trust_locks_update_owner"
  ON public.trust_locks
  FOR UPDATE
  TO authenticated
  USING (
    public.is_chat_participant(chat_id, auth.uid())
    AND (owner_user_id = auth.uid() OR enabled = false)
  )
  WITH CHECK (
    public.is_chat_participant(chat_id, auth.uid())
    AND owner_user_id = auth.uid()
  );

DROP TRIGGER IF EXISTS trust_locks_set_updated_at ON public.trust_locks;
CREATE TRIGGER trust_locks_set_updated_at
  BEFORE UPDATE ON public.trust_locks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

ALTER TABLE public.trust_locks REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.trust_locks';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;
