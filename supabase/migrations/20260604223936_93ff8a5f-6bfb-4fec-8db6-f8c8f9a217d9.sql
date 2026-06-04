
-- =============================================================
-- TRIBES FEATURE FOUNDATION
-- =============================================================

-- 1. NEW COLUMNS ----------------------------------------------------
ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS privacy text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.chats
  DROP CONSTRAINT IF EXISTS chats_privacy_check;
ALTER TABLE public.chats
  ADD CONSTRAINT chats_privacy_check CHECK (privacy IN ('public','private'));

-- handle: lowercase, alnum + underscores, 3-30 chars, globally unique among groups
ALTER TABLE public.chats
  DROP CONSTRAINT IF EXISTS chats_handle_format_check;
ALTER TABLE public.chats
  ADD CONSTRAINT chats_handle_format_check CHECK (
    handle IS NULL OR (handle ~ '^[a-z0-9_]{3,30}$')
  );

CREATE UNIQUE INDEX IF NOT EXISTS chats_handle_unique_idx
  ON public.chats (handle) WHERE handle IS NOT NULL;

ALTER TABLE public.chat_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';
ALTER TABLE public.chat_members
  DROP CONSTRAINT IF EXISTS chat_members_role_check;
ALTER TABLE public.chat_members
  ADD CONSTRAINT chat_members_role_check CHECK (role IN ('leader','member'));

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'user';
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_type_check CHECK (message_type IN ('user','system'));

-- 2. NEW TABLES -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tribe_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tribe_invites TO authenticated;
GRANT ALL ON public.tribe_invites TO service_role;
ALTER TABLE public.tribe_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.tribe_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, user_id)
);
ALTER TABLE public.tribe_join_requests
  DROP CONSTRAINT IF EXISTS tribe_join_requests_status_check;
ALTER TABLE public.tribe_join_requests
  ADD CONSTRAINT tribe_join_requests_status_check
  CHECK (status IN ('pending','approved','declined'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tribe_join_requests TO authenticated;
GRANT ALL ON public.tribe_join_requests TO service_role;
ALTER TABLE public.tribe_join_requests ENABLE ROW LEVEL SECURITY;

-- 3. HELPER FUNCTIONS ----------------------------------------------
CREATE OR REPLACE FUNCTION public.is_tribe_leader(_chat_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
     WHERE chat_id = _chat_id AND user_id = _user_id AND role = 'leader'
  ) OR EXISTS (
    SELECT 1 FROM public.chats WHERE id = _chat_id AND created_by = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tribe_member(_chat_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
     WHERE chat_id = _chat_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tribe_founder(_chat_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chats WHERE id = _chat_id AND created_by = _user_id)
$$;

-- 4. SYSTEM-MESSAGE HELPER + TRIGGERS ------------------------------
CREATE OR REPLACE FUNCTION public._insert_tribe_system_message(_chat_id uuid, _content text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.messages (chat_id, sender_id, content, message_type, message_status)
  VALUES (_chat_id, NULL, _content, 'system', 'sent');
END; $$;

-- on tribe creation: leader membership + system message
CREATE OR REPLACE FUNCTION public._on_tribe_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF COALESCE(NEW.is_group,false) = false THEN RETURN NEW; END IF;
  -- ensure founder is a leader member
  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'leader')
  ON CONFLICT DO NOTHING;
  SELECT COALESCE(full_name, username, 'Someone') INTO _name
    FROM public.user_profiles WHERE id = NEW.created_by;
  PERFORM public._insert_tribe_system_message(
    NEW.id,
    'Tribe created on ' || to_char(NEW.created_at AT TIME ZONE 'UTC', 'DD Mon YYYY')
      || ' by Tribe Leader ' || COALESCE(_name,'Someone')
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_tribe_created ON public.chats;
CREATE TRIGGER on_tribe_created
AFTER INSERT ON public.chats
FOR EACH ROW EXECUTE FUNCTION public._on_tribe_created();

-- name / privacy change announcements
CREATE OR REPLACE FUNCTION public._on_tribe_chat_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.is_group,false) = false THEN RETURN NEW; END IF;
  IF NEW.name IS DISTINCT FROM OLD.name AND NEW.name IS NOT NULL THEN
    PERFORM public._insert_tribe_system_message(NEW.id, 'Tribe renamed to ' || NEW.name);
  END IF;
  IF NEW.privacy IS DISTINCT FROM OLD.privacy THEN
    PERFORM public._insert_tribe_system_message(
      NEW.id, 'Tribe is now ' || initcap(NEW.privacy)
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_tribe_chat_updated ON public.chats;
CREATE TRIGGER on_tribe_chat_updated
AFTER UPDATE ON public.chats
FOR EACH ROW EXECUTE FUNCTION public._on_tribe_chat_updated();

-- member join announcements (skip the founder insert which happens with the
-- "tribe created" message)
CREATE OR REPLACE FUNCTION public._on_chat_member_added()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_group boolean; _founder uuid; _name text;
BEGIN
  SELECT is_group, created_by INTO _is_group, _founder FROM public.chats WHERE id = NEW.chat_id;
  IF COALESCE(_is_group,false) = false THEN RETURN NEW; END IF;
  IF NEW.user_id = _founder THEN RETURN NEW; END IF; -- founder announced by tribe-created msg
  SELECT COALESCE(full_name, username, 'Someone') INTO _name
    FROM public.user_profiles WHERE id = NEW.user_id;
  PERFORM public._insert_tribe_system_message(NEW.chat_id, COALESCE(_name,'Someone') || ' joined the tribe');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_chat_member_added ON public.chat_members;
CREATE TRIGGER on_chat_member_added
AFTER INSERT ON public.chat_members
FOR EACH ROW EXECUTE FUNCTION public._on_chat_member_added();

-- member leave announcement + founder protection
CREATE OR REPLACE FUNCTION public._on_chat_member_removed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_group boolean; _founder uuid; _name text;
BEGIN
  SELECT is_group, created_by INTO _is_group, _founder FROM public.chats WHERE id = OLD.chat_id;
  IF COALESCE(_is_group,false) = false THEN RETURN OLD; END IF;
  IF OLD.user_id = _founder AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'The tribe founder cannot leave or be removed. Delete the tribe instead.';
  END IF;
  SELECT COALESCE(full_name, username, 'Someone') INTO _name
    FROM public.user_profiles WHERE id = OLD.user_id;
  PERFORM public._insert_tribe_system_message(OLD.chat_id, COALESCE(_name,'Someone') || ' left the tribe');
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS on_chat_member_removed ON public.chat_members;
CREATE TRIGGER on_chat_member_removed
AFTER DELETE ON public.chat_members
FOR EACH ROW EXECUTE FUNCTION public._on_chat_member_removed();

-- role change announcement + founder demotion protection
CREATE OR REPLACE FUNCTION public._on_chat_member_role_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_group boolean; _founder uuid; _name text;
BEGIN
  IF NEW.role = OLD.role THEN RETURN NEW; END IF;
  SELECT is_group, created_by INTO _is_group, _founder FROM public.chats WHERE id = NEW.chat_id;
  IF COALESCE(_is_group,false) = false THEN RETURN NEW; END IF;
  IF NEW.user_id = _founder AND NEW.role <> 'leader' THEN
    RAISE EXCEPTION 'The tribe founder must remain a leader.';
  END IF;
  SELECT COALESCE(full_name, username, 'Someone') INTO _name
    FROM public.user_profiles WHERE id = NEW.user_id;
  IF NEW.role = 'leader' THEN
    PERFORM public._insert_tribe_system_message(NEW.chat_id, COALESCE(_name,'Someone') || ' is now a Tribe Leader');
  ELSE
    PERFORM public._insert_tribe_system_message(NEW.chat_id, COALESCE(_name,'Someone') || ' is no longer a Tribe Leader');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_chat_member_role_changed ON public.chat_members;
CREATE TRIGGER on_chat_member_role_changed
AFTER UPDATE ON public.chat_members
FOR EACH ROW EXECUTE FUNCTION public._on_chat_member_role_changed();

-- handle immutability (once set, only master admin can change/clear it)
CREATE OR REPLACE FUNCTION public._guard_tribe_handle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.handle IS NOT NULL AND NEW.handle IS DISTINCT FROM OLD.handle THEN
    IF NOT public.is_master_admin() THEN
      RAISE EXCEPTION 'The tribe @handle is permanent and can only be changed by the platform admin.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_tribe_handle ON public.chats;
CREATE TRIGGER guard_tribe_handle
BEFORE UPDATE OF handle ON public.chats
FOR EACH ROW EXECUTE FUNCTION public._guard_tribe_handle();

-- 5. RLS for new tables --------------------------------------------
DROP POLICY IF EXISTS tribe_invites_select ON public.tribe_invites;
CREATE POLICY tribe_invites_select ON public.tribe_invites
  FOR SELECT TO authenticated
  USING (public.is_tribe_member(chat_id, auth.uid()) OR public.is_admin_user());

DROP POLICY IF EXISTS tribe_invites_insert ON public.tribe_invites;
CREATE POLICY tribe_invites_insert ON public.tribe_invites
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.is_tribe_leader(chat_id, auth.uid()) OR public.is_admin_user()));

DROP POLICY IF EXISTS tribe_invites_update ON public.tribe_invites;
CREATE POLICY tribe_invites_update ON public.tribe_invites
  FOR UPDATE TO authenticated
  USING (public.is_tribe_leader(chat_id, auth.uid()) OR public.is_admin_user())
  WITH CHECK (public.is_tribe_leader(chat_id, auth.uid()) OR public.is_admin_user());

DROP POLICY IF EXISTS tribe_invites_delete ON public.tribe_invites;
CREATE POLICY tribe_invites_delete ON public.tribe_invites
  FOR DELETE TO authenticated
  USING (public.is_tribe_leader(chat_id, auth.uid()) OR public.is_admin_user());

DROP POLICY IF EXISTS tribe_join_requests_select ON public.tribe_join_requests;
CREATE POLICY tribe_join_requests_select ON public.tribe_join_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_tribe_leader(chat_id, auth.uid()) OR public.is_admin_user());

DROP POLICY IF EXISTS tribe_join_requests_insert ON public.tribe_join_requests;
CREATE POLICY tribe_join_requests_insert ON public.tribe_join_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS tribe_join_requests_update ON public.tribe_join_requests;
CREATE POLICY tribe_join_requests_update ON public.tribe_join_requests
  FOR UPDATE TO authenticated
  USING (public.is_tribe_leader(chat_id, auth.uid()) OR public.is_admin_user())
  WITH CHECK (public.is_tribe_leader(chat_id, auth.uid()) OR public.is_admin_user());

-- 6. Update chat_members policies ----------------------------------
-- (Keep existing self-leave + self-add policies; add leader powers.)
DROP POLICY IF EXISTS members_insert_by_leader ON public.chat_members;
CREATE POLICY members_insert_by_leader ON public.chat_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tribe_leader(chat_id, auth.uid()) OR public.is_admin_user());

DROP POLICY IF EXISTS members_delete_by_leader ON public.chat_members;
CREATE POLICY members_delete_by_leader ON public.chat_members
  FOR DELETE TO authenticated
  USING (public.is_tribe_leader(chat_id, auth.uid()) OR public.is_admin_user());

DROP POLICY IF EXISTS members_update_role_by_leader ON public.chat_members;
CREATE POLICY members_update_role_by_leader ON public.chat_members
  FOR UPDATE TO authenticated
  USING (public.is_tribe_leader(chat_id, auth.uid()) OR public.is_admin_user())
  WITH CHECK (public.is_tribe_leader(chat_id, auth.uid()) OR public.is_admin_user());

-- 7. chats UPDATE: members read, only leaders/admin modify ---------
DROP POLICY IF EXISTS leaders_update_tribe ON public.chats;
CREATE POLICY leaders_update_tribe ON public.chats
  FOR UPDATE TO authenticated
  USING (
    (is_group = true AND (public.is_tribe_leader(id, auth.uid()) OR public.is_admin_user()))
    OR (is_group = false AND ((created_by = auth.uid()) OR (participant_one = auth.uid()) OR (participant_two = auth.uid())))
  )
  WITH CHECK (
    (is_group = true AND (public.is_tribe_leader(id, auth.uid()) OR public.is_admin_user()))
    OR (is_group = false AND ((created_by = auth.uid()) OR (participant_one = auth.uid()) OR (participant_two = auth.uid())))
  );

-- public read of minimal tribe info via a view (for invite preview + global search by handle)
CREATE OR REPLACE VIEW public.tribe_public WITH (security_invoker = on) AS
  SELECT id, name, handle, avatar_url, privacy, created_at,
         (SELECT count(*) FROM public.chat_members cm WHERE cm.chat_id = c.id) AS member_count
    FROM public.chats c
   WHERE is_group = true AND handle IS NOT NULL;
GRANT SELECT ON public.tribe_public TO authenticated, anon;

DROP POLICY IF EXISTS chats_minimal_read_for_handle ON public.chats;
CREATE POLICY chats_minimal_read_for_handle ON public.chats
  FOR SELECT TO authenticated
  USING (is_group = true AND handle IS NOT NULL);

-- 8. messages: leaders can hard-delete any message in their tribe --
DROP POLICY IF EXISTS leaders_delete_tribe_messages ON public.messages;
CREATE POLICY leaders_delete_tribe_messages ON public.messages
  FOR UPDATE TO authenticated
  USING (public.is_tribe_leader(chat_id, auth.uid()) OR public.is_admin_user())
  WITH CHECK (public.is_tribe_leader(chat_id, auth.uid()) OR public.is_admin_user());

CREATE OR REPLACE FUNCTION public.tribe_delete_message_as_leader(_msg_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _chat uuid;
BEGIN
  SELECT chat_id INTO _chat FROM public.messages WHERE id = _msg_id;
  IF _chat IS NULL THEN RETURN; END IF;
  IF NOT (public.is_tribe_leader(_chat, auth.uid()) OR public.is_master_admin()) THEN
    RAISE EXCEPTION 'Only Tribe Leaders can delete messages for everyone';
  END IF;
  UPDATE public.messages
     SET deleted_for_everyone = true, content = '__deleted_for_everyone__'
   WHERE id = _msg_id;
END; $$;

-- 9. RPCs for join/invite/leader actions ---------------------------
CREATE OR REPLACE FUNCTION public.tribe_join_via_invite(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _chat uuid; _inv record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _inv FROM public.tribe_invites WHERE code = _code;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'Invalid invite link'; END IF;
  IF _inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This invite has been revoked'; END IF;
  IF _inv.expires_at IS NOT NULL AND _inv.expires_at < now() THEN RAISE EXCEPTION 'This invite has expired'; END IF;
  _chat := _inv.chat_id;
  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (_chat, auth.uid(), 'member')
  ON CONFLICT DO NOTHING;
  RETURN _chat;
END; $$;

CREATE OR REPLACE FUNCTION public.tribe_join_public(_chat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _priv text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT privacy INTO _priv FROM public.chats WHERE id = _chat_id AND is_group = true;
  IF _priv IS NULL THEN RAISE EXCEPTION 'Tribe not found'; END IF;
  IF _priv <> 'public' THEN RAISE EXCEPTION 'This tribe is private'; END IF;
  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (_chat_id, auth.uid(), 'member')
  ON CONFLICT DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.tribe_request_join(_chat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _priv text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT privacy INTO _priv FROM public.chats WHERE id = _chat_id AND is_group = true;
  IF _priv IS NULL THEN RAISE EXCEPTION 'Tribe not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = _chat_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are already a member';
  END IF;
  INSERT INTO public.tribe_join_requests (chat_id, user_id, status)
  VALUES (_chat_id, auth.uid(), 'pending')
  ON CONFLICT (chat_id, user_id) DO UPDATE SET status = 'pending', decided_by = NULL, decided_at = NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.tribe_decide_request(_request_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req record; _tribe_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _req FROM public.tribe_join_requests WHERE id = _request_id;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT (public.is_tribe_leader(_req.chat_id, auth.uid()) OR public.is_master_admin()) THEN
    RAISE EXCEPTION 'Only Tribe Leaders can decide join requests';
  END IF;
  UPDATE public.tribe_join_requests
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'declined' END,
         decided_by = auth.uid(), decided_at = now()
   WHERE id = _request_id;
  IF _approve THEN
    INSERT INTO public.chat_members (chat_id, user_id, role)
    VALUES (_req.chat_id, _req.user_id, 'member')
    ON CONFLICT DO NOTHING;
  ELSE
    SELECT name INTO _tribe_name FROM public.chats WHERE id = _req.chat_id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      _req.user_id, 'tribe_request_declined',
      'Tribe join request declined',
      'Your request to join "' || COALESCE(_tribe_name,'this tribe') || '" was declined.',
      '/'
    );
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.tribe_set_handle(_chat_id uuid, _handle text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _existing text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT handle INTO _existing FROM public.chats WHERE id = _chat_id AND is_group = true;
  IF _existing IS NOT NULL AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'The tribe @handle is permanent and can only be changed by the platform admin.';
  END IF;
  IF NOT (public.is_tribe_leader(_chat_id, auth.uid()) OR public.is_master_admin()) THEN
    RAISE EXCEPTION 'Only Tribe Leaders can set the handle';
  END IF;
  IF _handle !~ '^[a-z0-9_]{3,30}$' THEN
    RAISE EXCEPTION 'Handle must be 3-30 characters, lowercase letters/numbers/underscore only';
  END IF;
  UPDATE public.chats SET handle = _handle WHERE id = _chat_id;
END; $$;

CREATE OR REPLACE FUNCTION public.tribe_change_privacy(_chat_id uuid, _privacy text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_tribe_leader(_chat_id, auth.uid()) OR public.is_master_admin()) THEN
    RAISE EXCEPTION 'Only Tribe Leaders can change privacy';
  END IF;
  IF _privacy NOT IN ('public','private') THEN RAISE EXCEPTION 'Invalid privacy value'; END IF;
  UPDATE public.chats SET privacy = _privacy WHERE id = _chat_id AND is_group = true;
  IF _privacy = 'public' THEN
    -- auto-approve all pending requests
    INSERT INTO public.chat_members (chat_id, user_id, role)
    SELECT chat_id, user_id, 'member' FROM public.tribe_join_requests
    WHERE chat_id = _chat_id AND status = 'pending'
    ON CONFLICT DO NOTHING;
    UPDATE public.tribe_join_requests
       SET status = 'approved', decided_by = auth.uid(), decided_at = now()
     WHERE chat_id = _chat_id AND status = 'pending';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.tribe_promote_member(_chat_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_tribe_leader(_chat_id, auth.uid()) OR public.is_master_admin()) THEN
    RAISE EXCEPTION 'Only Tribe Leaders can promote';
  END IF;
  UPDATE public.chat_members SET role = 'leader' WHERE chat_id = _chat_id AND user_id = _user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.tribe_demote_member(_chat_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _founder uuid;
BEGIN
  SELECT created_by INTO _founder FROM public.chats WHERE id = _chat_id;
  IF _user_id = _founder THEN RAISE EXCEPTION 'The founder cannot be demoted'; END IF;
  IF NOT (public.is_tribe_leader(_chat_id, auth.uid()) OR public.is_master_admin()) THEN
    RAISE EXCEPTION 'Only Tribe Leaders can demote';
  END IF;
  UPDATE public.chat_members SET role = 'member' WHERE chat_id = _chat_id AND user_id = _user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.tribe_remove_member(_chat_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _founder uuid;
BEGIN
  SELECT created_by INTO _founder FROM public.chats WHERE id = _chat_id;
  IF _user_id = _founder THEN RAISE EXCEPTION 'The founder cannot be removed'; END IF;
  IF NOT (public.is_tribe_leader(_chat_id, auth.uid()) OR public.is_master_admin()) THEN
    RAISE EXCEPTION 'Only Tribe Leaders can remove members';
  END IF;
  DELETE FROM public.chat_members WHERE chat_id = _chat_id AND user_id = _user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.tribe_leave(_chat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _founder uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT created_by INTO _founder FROM public.chats WHERE id = _chat_id;
  IF auth.uid() = _founder THEN
    RAISE EXCEPTION 'The founder cannot leave the tribe. Delete it instead.';
  END IF;
  DELETE FROM public.chat_members WHERE chat_id = _chat_id AND user_id = auth.uid();
END; $$;

-- 10. Admin: list of all tribes ------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_tribes()
RETURNS TABLE(
  id uuid, name text, handle text, avatar_url text, privacy text,
  created_at timestamptz, created_by uuid, founder_name text, member_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Master admin access required';
  END IF;
  RETURN QUERY
    SELECT c.id, c.name, c.handle, c.avatar_url, c.privacy, c.created_at, c.created_by,
           COALESCE(up.full_name, up.username, '—') AS founder_name,
           (SELECT count(*) FROM public.chat_members cm WHERE cm.chat_id = c.id) AS member_count
      FROM public.chats c
      LEFT JOIN public.user_profiles up ON up.id = c.created_by
     WHERE c.is_group = true
     ORDER BY c.created_at DESC;
END; $$;

-- 11. Backfill existing groups: founder as leader ------------------
UPDATE public.chat_members cm
   SET role = 'leader'
  FROM public.chats c
 WHERE c.id = cm.chat_id AND c.is_group = true AND c.created_by = cm.user_id;

-- 12. Realtime ----------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.tribe_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tribe_join_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
