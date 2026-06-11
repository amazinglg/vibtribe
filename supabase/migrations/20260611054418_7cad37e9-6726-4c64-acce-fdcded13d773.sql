-- 1) tribe_delete: founder or master admin can fully delete a tribe
CREATE OR REPLACE FUNCTION public.tribe_delete(_chat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_master boolean;
  v_is_founder boolean;
  v_is_group boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT (c.is_group OR c.chat_type = 'group'), (c.created_by = auth.uid())
    INTO v_is_group, v_is_founder
  FROM public.chats c
  WHERE c.id = _chat_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tribe not found';
  END IF;

  SELECT COALESCE(up.is_master_admin, false) INTO v_is_master
  FROM public.user_profiles up
  WHERE up.id = auth.uid();

  IF NOT (v_is_founder OR COALESCE(v_is_master, false)) THEN
    RAISE EXCEPTION 'Only the tribe founder or master admin can delete this tribe';
  END IF;

  -- Best-effort sibling cleanup (some may not have CASCADE)
  BEGIN DELETE FROM public.tribe_invites WHERE chat_id = _chat_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.tribe_join_requests WHERE chat_id = _chat_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.chat_mutes WHERE chat_id = _chat_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.user_secure_chats WHERE chat_id = _chat_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.calls WHERE chat_id = _chat_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.notifications WHERE (payload->>'chat_id') = _chat_id::text; EXCEPTION WHEN others THEN NULL; END;

  -- Cascades messages and chat_members
  DELETE FROM public.chats WHERE id = _chat_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tribe_delete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tribe_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tribe_delete(uuid) TO service_role;

-- 2) Additional admin permission keys
INSERT INTO public.permission_keys (key, label, category) VALUES
  ('releases.view',    'View releases',     'Releases'),
  ('releases.publish', 'Publish releases',  'Releases'),
  ('releases.delete',  'Delete releases',   'Releases'),
  ('roles.view',       'View roles',        'Roles'),
  ('roles.manage',     'Manage roles',      'Roles'),
  ('analytics.view',   'View analytics',    'Analytics'),
  ('audit.view',       'View audit log',    'Audit'),
  ('storage.view',     'View storage',      'Storage'),
  ('storage.delete',   'Delete storage',    'Storage')
ON CONFLICT (key) DO NOTHING;

-- Seed sensible defaults for built-in roles (admin = all, moderator = view-only)
DO $$
DECLARE
  v_admin_exists boolean;
  v_mod_exists boolean;
  k record;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.app_roles WHERE key = 'admin') INTO v_admin_exists;
  SELECT EXISTS(SELECT 1 FROM public.app_roles WHERE key = 'moderator') INTO v_mod_exists;

  FOR k IN
    SELECT key FROM public.permission_keys
    WHERE key IN (
      'releases.view','releases.publish','releases.delete',
      'roles.view','roles.manage','analytics.view','audit.view',
      'storage.view','storage.delete'
    )
  LOOP
    IF v_admin_exists THEN
      INSERT INTO public.role_permissions (role_key, permission_key, allowed)
      VALUES ('admin', k.key, true)
      ON CONFLICT (role_key, permission_key) DO NOTHING;
    END IF;
    IF v_mod_exists AND k.key IN ('releases.view','roles.view','analytics.view','audit.view','storage.view') THEN
      INSERT INTO public.role_permissions (role_key, permission_key, allowed)
      VALUES ('moderator', k.key, true)
      ON CONFLICT (role_key, permission_key) DO NOTHING;
    END IF;
  END LOOP;
END $$;