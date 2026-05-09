
-- 1) notifications: add link column
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;

-- 2) Trigger to notify all admins + master admin when a new support ticket is created
CREATE OR REPLACE FUNCTION public.notify_admins_new_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, related_user_id, link)
  SELECT up.id,
         'support_ticket',
         'New Support Ticket: ' || NEW.issue_title,
         NEW.name || ' (' || NEW.email || ')',
         NEW.user_id,
         '/admin?ticket=' || NEW.id::text
  FROM public.user_profiles up
  WHERE up.role = 'admin' OR up.is_master_admin = true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_ticket ON public.support_tickets;
CREATE TRIGGER trg_notify_admins_new_ticket
AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_ticket();

-- 3) Self-delete account RPC — fully removes user and all related data
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Wipe user-owned data
  DELETE FROM public.messages WHERE sender_id = uid;
  DELETE FROM public.statuses WHERE user_id = uid;
  DELETE FROM public.blocked_users WHERE blocker_id = uid OR blocked_user_id = uid;
  DELETE FROM public.chat_members WHERE user_id = uid;
  DELETE FROM public.chats WHERE participant_one = uid OR participant_two = uid OR created_by = uid;
  DELETE FROM public.calls WHERE caller_id = uid OR callee_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid OR related_user_id = uid;
  DELETE FROM public.push_subscriptions WHERE user_id = uid;
  DELETE FROM public.support_tickets WHERE user_id = uid;
  DELETE FROM public.force_logout_tokens WHERE user_id = uid;
  DELETE FROM public.user_profiles WHERE id = uid;
  -- Finally remove auth.users entry
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- 4) Restrict role changes: only master admin can change roles or set master admin.
-- We add a guard trigger on user_profiles.
CREATE OR REPLACE FUNCTION public.guard_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE actor_is_master boolean;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    SELECT COALESCE(is_master_admin, false) INTO actor_is_master
    FROM public.user_profiles WHERE id = auth.uid();
    IF NOT COALESCE(actor_is_master, false) THEN
      RAISE EXCEPTION 'Only the master admin can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_role_changes ON public.user_profiles;
CREATE TRIGGER trg_guard_role_changes
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_role_changes();
