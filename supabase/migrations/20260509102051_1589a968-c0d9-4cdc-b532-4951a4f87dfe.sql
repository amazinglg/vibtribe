-- ============================================================
-- 1) blocked_users
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(blocker_id, blocked_user_id)
);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_id ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_user_id ON public.blocked_users(blocked_user_id);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_manage_own_blocked_users" ON public.blocked_users;
CREATE POLICY "users_manage_own_blocked_users" ON public.blocked_users
  FOR ALL TO authenticated
  USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

-- ============================================================
-- 2) chats: secure_code column (existing chat_type already exists)
-- ============================================================
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS secure_code TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_chats_secure_code ON public.chats(secure_code) WHERE secure_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chats_chat_type ON public.chats(chat_type);

-- ============================================================
-- 3) support_tickets + admin helper + suspended flags
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open', 'inprocess', 'solved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  issue_title TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  ticket_status public.ticket_status DEFAULT 'open'::public.ticket_status,
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(ticket_status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_create_ticket" ON public.support_tickets;
CREATE POLICY "anyone_can_create_ticket" ON public.support_tickets
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "users_view_own_tickets" ON public.support_tickets;
CREATE POLICY "users_view_own_tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "admin_update_tickets" ON public.support_tickets;
CREATE POLICY "admin_update_tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_delete_tickets" ON public.support_tickets;
CREATE POLICY "admin_delete_tickets" ON public.support_tickets
  FOR DELETE TO authenticated USING (public.is_admin_user());

DROP POLICY IF EXISTS "admin_insert_notifications" ON public.notifications;
CREATE POLICY "admin_insert_notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user() OR user_id = auth.uid());

DROP POLICY IF EXISTS "admin_read_all_notifications" ON public.notifications;
CREATE POLICY "admin_read_all_notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "admin_update_any_profile" ON public.user_profiles;
CREATE POLICY "admin_update_any_profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin_user())
  WITH CHECK (id = auth.uid() OR public.is_admin_user());

-- ============================================================
-- 4) force_logout_tokens (admin-only insert — hardened from zip)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.force_logout_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  issued_at timestamptz DEFAULT now() NOT NULL,
  issued_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_force_logout_tokens_user_id ON public.force_logout_tokens(user_id);
ALTER TABLE public.force_logout_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own force logout tokens" ON public.force_logout_tokens;
CREATE POLICY "Users can read own force logout tokens"
  ON public.force_logout_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert force logout tokens" ON public.force_logout_tokens;
DROP POLICY IF EXISTS "Admins can insert force logout tokens" ON public.force_logout_tokens;
CREATE POLICY "Admins can insert force logout tokens"
  ON public.force_logout_tokens FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Users can delete own force logout tokens" ON public.force_logout_tokens;
CREATE POLICY "Users can delete own force logout tokens"
  ON public.force_logout_tokens FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS app_theme text DEFAULT 'theme-1';

-- ============================================================
-- 5) push_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_manage_own_push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "users_manage_own_push_subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 6) Production hardening (point 3 from earlier discussion)
-- Lock down SECURITY DEFINER helpers + harden secrets management
-- ============================================================
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.is_chat_participant(uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_chat_participant(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(uuid) TO authenticated;