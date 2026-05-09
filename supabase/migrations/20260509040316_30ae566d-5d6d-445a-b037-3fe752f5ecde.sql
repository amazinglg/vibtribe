-- VibeTribe full schema
DROP TYPE IF EXISTS public.chat_type CASCADE;
CREATE TYPE public.chat_type AS ENUM ('normal', 'secure', 'dual_normal', 'dual_secure');
DROP TYPE IF EXISTS public.message_status CASCADE;
CREATE TYPE public.message_status AS ENUM ('sent', 'delivered', 'read');
DROP TYPE IF EXISTS public.user_status CASCADE;
CREATE TYPE public.user_status AS ENUM ('active', 'suspended', 'inactive');

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  mobile_number TEXT,
  username TEXT UNIQUE,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  account_status public.user_status DEFAULT 'active'::public.user_status,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  profile_completed BOOLEAN DEFAULT false,
  public_key TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_type public.chat_type DEFAULT 'normal'::public.chat_type,
  participant_one UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  participant_two UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  secure_code_hash TEXT,
  is_secure BOOLEAN DEFAULT false,
  parent_chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_status public.message_status DEFAULT 'sent'::public.message_status,
  reactions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT DEFAULT 'text',
  background_color TEXT DEFAULT '#7C3AED',
  expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  view_count INTEGER DEFAULT 0,
  visibility TEXT DEFAULT 'all' CHECK (visibility IN ('all','contacts','selected')),
  selected_viewers UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT false,
  related_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_mobile ON public.user_profiles(mobile_number);
CREATE INDEX IF NOT EXISTS idx_chats_participant_one ON public.chats(participant_one);
CREATE INDEX IF NOT EXISTS idx_chats_participant_two ON public.chats(participant_two);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_statuses_user_id ON public.statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_statuses_expires_at ON public.statuses(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, mobile_number, role, avatar_url)
  VALUES (
    NEW.id, COALESCE(NEW.email,''),
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'mobile_number',''),
    COALESCE(NEW.raw_user_meta_data->>'role','user'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url','')
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_chat_participant(chat_uuid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT EXISTS (SELECT 1 FROM public.chats WHERE id = chat_uuid AND (participant_one = auth.uid() OR participant_two = auth.uid()))
$$;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_profile" ON public.user_profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "users_view_all_profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_all_profiles" ON public.user_profiles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "users_manage_own_chats" ON public.chats FOR ALL TO authenticated USING (participant_one = auth.uid() OR participant_two = auth.uid()) WITH CHECK (participant_one = auth.uid() OR participant_two = auth.uid());
CREATE POLICY "admin_view_all_chats" ON public.chats FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "users_manage_chat_messages" ON public.messages FOR ALL TO authenticated USING (public.is_chat_participant(chat_id)) WITH CHECK (sender_id = auth.uid() AND public.is_chat_participant(chat_id));
CREATE POLICY "admin_view_all_messages" ON public.messages FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "users_manage_own_statuses" ON public.statuses FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_view_active_statuses" ON public.statuses FOR SELECT TO authenticated USING (expires_at > CURRENT_TIMESTAMP);

CREATE POLICY "users_manage_own_notifications" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_chats_updated_at ON public.chats;
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();