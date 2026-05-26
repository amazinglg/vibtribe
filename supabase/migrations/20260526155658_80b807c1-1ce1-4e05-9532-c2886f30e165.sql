
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('user','admin','system')),
  sender_id uuid,
  sender_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON public.support_ticket_messages(ticket_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket owner can view messages"
ON public.support_ticket_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id
      AND (t.user_id = auth.uid() OR public.is_admin_user())
  )
);

CREATE POLICY "admins manage messages"
ON public.support_ticket_messages FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE POLICY "ticket owner can reply"
ON public.support_ticket_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'user'
  AND sender_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.admin_delete_ticket(_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  DELETE FROM public.support_ticket_messages WHERE ticket_id = _ticket_id;
  DELETE FROM public.notifications WHERE link LIKE '%' || _ticket_id::text || '%';
  DELETE FROM public.support_tickets WHERE id = _ticket_id;
END;
$$;
