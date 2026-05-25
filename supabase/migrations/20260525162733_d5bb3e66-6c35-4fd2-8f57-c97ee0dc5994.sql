
CREATE TABLE public.broadcast_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  attachment_url TEXT,
  attachment_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcast_messages_created_at ON public.broadcast_messages(created_at DESC);

ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view broadcasts"
  ON public.broadcast_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only master admin can post broadcasts"
  ON public.broadcast_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_master_admin() AND sender_id = auth.uid());

CREATE POLICY "Only master admin can delete broadcasts"
  ON public.broadcast_messages FOR DELETE TO authenticated
  USING (public.is_master_admin());

CREATE POLICY "Only master admin can edit broadcasts"
  ON public.broadcast_messages FOR UPDATE TO authenticated
  USING (public.is_master_admin());

CREATE TABLE public.broadcast_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.broadcast_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_broadcast_reactions_message ON public.broadcast_reactions(message_id);

ALTER TABLE public.broadcast_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reactions"
  ON public.broadcast_reactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can add own reaction"
  ON public.broadcast_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove own reaction"
  ON public.broadcast_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_reactions;
