
-- 1. Deleted users audit log ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.deleted_users_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id UUID NOT NULL,
  full_name TEXT,
  email TEXT,
  mobile_number TEXT,
  country_code TEXT,
  mobile_hash TEXT,
  initiated_by TEXT NOT NULL CHECK (initiated_by IN ('user','admin')),
  initiator_id UUID,
  reason_key TEXT NOT NULL,
  reason_text TEXT,
  terms_breach BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deleted_users_log TO authenticated;
GRANT ALL ON public.deleted_users_log TO service_role;
ALTER TABLE public.deleted_users_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view deleted users log" ON public.deleted_users_log
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE INDEX IF NOT EXISTS idx_deleted_users_log_deleted_at ON public.deleted_users_log(deleted_at DESC);

-- 2. Sign-up block list ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocked_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_lower TEXT,
  mobile_hash TEXT,
  reason TEXT NOT NULL DEFAULT 'terms_breach',
  source_user_id UUID,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unblocked_at TIMESTAMPTZ,
  unblocked_by UUID,
  notes TEXT
);
GRANT SELECT ON public.blocked_signups TO authenticated;
GRANT ALL ON public.blocked_signups TO service_role;
ALTER TABLE public.blocked_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view blocked signups" ON public.blocked_signups
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE INDEX IF NOT EXISTS idx_blocked_signups_email ON public.blocked_signups(email_lower) WHERE unblocked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_blocked_signups_mobile ON public.blocked_signups(mobile_hash) WHERE unblocked_at IS NULL;

-- 3. Offboarding appeals (public, token-based) ----------------------------
CREATE TABLE IF NOT EXISTS public.offboarding_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES public.blocked_signups(id) ON DELETE CASCADE,
  original_user_id UUID,
  token TEXT NOT NULL UNIQUE,
  appellant_email TEXT,
  appellant_name TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_submission'
    CHECK (status IN ('awaiting_submission','pending','approved','rejected')),
  reviewer_id UUID,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.offboarding_appeals TO authenticated;
GRANT ALL ON public.offboarding_appeals TO service_role;
ALTER TABLE public.offboarding_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view offboarding appeals" ON public.offboarding_appeals
  FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE INDEX IF NOT EXISTS idx_offboarding_appeals_status ON public.offboarding_appeals(status, created_at DESC);

-- 4. Is-blocked check -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_signup_blocked(_email TEXT, _mobile_hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_signups
    WHERE unblocked_at IS NULL
      AND (
        (_email IS NOT NULL AND email_lower = lower(_email))
        OR (_mobile_hash IS NOT NULL AND mobile_hash = _mobile_hash)
      )
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_signup_blocked(TEXT, TEXT) TO anon, authenticated, service_role;

-- 5. Extended admin_delete_user (accepts reason + optional appeal token) --
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  _user_id UUID,
  _reason_key TEXT DEFAULT 'general',
  _reason_text TEXT DEFAULT NULL,
  _appeal_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_is_master BOOLEAN;
  actor UUID := auth.uid();
  is_service BOOLEAN := (current_setting('request.jwt.claim.role', true) = 'service_role');
  v_email TEXT; v_real_email TEXT; v_mobile TEXT; v_country TEXT;
  v_full_name TEXT; v_mobile_hash TEXT;
  v_block_id UUID;
  v_terms_breach BOOLEAN := (_reason_key = 'terms_breach');
BEGIN
  IF NOT is_service AND NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  IF NOT is_service AND _user_id = actor THEN
    RAISE EXCEPTION 'Use delete_my_account to delete your own account';
  END IF;

  SELECT COALESCE(is_master_admin, false), email, real_email, mobile_number, country_code, full_name, mobile_hash
    INTO target_is_master, v_email, v_real_email, v_mobile, v_country, v_full_name, v_mobile_hash
    FROM public.user_profiles WHERE id = _user_id;
  IF COALESCE(target_is_master, false) THEN
    RAISE EXCEPTION 'Cannot delete the master admin account';
  END IF;
  IF v_mobile_hash IS NULL AND v_mobile IS NOT NULL THEN
    v_mobile_hash := public.compute_mobile_hash(v_mobile);
  END IF;

  -- Log deletion FIRST (before we lose the profile row)
  INSERT INTO public.deleted_users_log (
    original_user_id, full_name, email, mobile_number, country_code, mobile_hash,
    initiated_by, initiator_id, reason_key, reason_text, terms_breach
  ) VALUES (
    _user_id, v_full_name,
    COALESCE(v_real_email, v_email), v_mobile, v_country, v_mobile_hash,
    'admin', actor, _reason_key, _reason_text, v_terms_breach
  );

  -- Block future sign-ups for terms breaches; create appeal placeholder
  IF v_terms_breach THEN
    INSERT INTO public.blocked_signups (
      email_lower, mobile_hash, reason, source_user_id
    ) VALUES (
      lower(COALESCE(v_real_email, v_email)), v_mobile_hash, 'terms_breach', _user_id
    ) RETURNING id INTO v_block_id;

    IF _appeal_token IS NOT NULL THEN
      INSERT INTO public.offboarding_appeals (
        block_id, original_user_id, token, appellant_email, appellant_name, status
      ) VALUES (
        v_block_id, _user_id, _appeal_token,
        COALESCE(v_real_email, v_email), v_full_name, 'awaiting_submission'
      );
    END IF;
  END IF;

  DELETE FROM public.status_views WHERE viewer_id = _user_id;
  DELETE FROM public.status_views WHERE status_id IN (SELECT id FROM public.statuses WHERE user_id = _user_id);
  DELETE FROM public.statuses WHERE user_id = _user_id;
  DELETE FROM public.contacts WHERE user_id = _user_id OR contact_id = _user_id;
  DELETE FROM public.messages WHERE sender_id = _user_id;
  DELETE FROM public.messages WHERE chat_id IN (
    SELECT id FROM public.chats WHERE participant_one = _user_id OR participant_two = _user_id OR created_by = _user_id
  );
  DELETE FROM public.chat_members WHERE user_id = _user_id;
  DELETE FROM public.chat_members WHERE chat_id IN (
    SELECT id FROM public.chats WHERE participant_one = _user_id OR participant_two = _user_id OR created_by = _user_id
  );
  DELETE FROM public.chats WHERE participant_one = _user_id OR participant_two = _user_id OR created_by = _user_id;
  DELETE FROM public.calls WHERE caller_id = _user_id OR callee_id = _user_id;
  DELETE FROM public.blocked_users WHERE blocker_id = _user_id OR blocked_user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id OR related_user_id = _user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = _user_id;
  DELETE FROM public.support_tickets WHERE user_id = _user_id;
  DELETE FROM public.force_logout_tokens WHERE user_id = _user_id OR issued_by = _user_id;
  DELETE FROM public.user_profiles WHERE id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;

  RETURN jsonb_build_object('ok', true, 'blocked', v_terms_breach, 'appeal_token', _appeal_token);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 6. Extended delete_my_account (accepts reason for audit + email) --------
DROP FUNCTION IF EXISTS public.delete_my_account();
CREATE OR REPLACE FUNCTION public.delete_my_account(
  _reason_key TEXT DEFAULT 'unspecified',
  _reason_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  v_email TEXT; v_real_email TEXT; v_mobile TEXT; v_country TEXT;
  v_full_name TEXT; v_mobile_hash TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT email, real_email, mobile_number, country_code, full_name, mobile_hash
    INTO v_email, v_real_email, v_mobile, v_country, v_full_name, v_mobile_hash
    FROM public.user_profiles WHERE id = uid;
  IF v_mobile_hash IS NULL AND v_mobile IS NOT NULL THEN
    v_mobile_hash := public.compute_mobile_hash(v_mobile);
  END IF;

  INSERT INTO public.deleted_users_log (
    original_user_id, full_name, email, mobile_number, country_code, mobile_hash,
    initiated_by, initiator_id, reason_key, reason_text, terms_breach
  ) VALUES (
    uid, v_full_name, COALESCE(v_real_email, v_email), v_mobile, v_country, v_mobile_hash,
    'user', uid, _reason_key, _reason_text, false
  );

  DELETE FROM storage.objects
    WHERE bucket_id IN ('profile-photos','status-media')
      AND (split_part(name, '/', 1) = uid::text OR owner = uid);
  DELETE FROM public.status_views WHERE viewer_id = uid;
  DELETE FROM public.status_views WHERE status_id IN (SELECT id FROM public.statuses WHERE user_id = uid);
  DELETE FROM public.statuses WHERE user_id = uid;
  DELETE FROM public.contacts WHERE user_id = uid OR contact_id = uid;
  DELETE FROM public.messages WHERE sender_id = uid;
  DELETE FROM public.messages WHERE chat_id IN (
    SELECT id FROM public.chats WHERE participant_one = uid OR participant_two = uid OR created_by = uid
  );
  DELETE FROM public.chat_members WHERE user_id = uid;
  DELETE FROM public.chat_members WHERE chat_id IN (
    SELECT id FROM public.chats WHERE participant_one = uid OR participant_two = uid OR created_by = uid
  );
  DELETE FROM public.chats WHERE participant_one = uid OR participant_two = uid OR created_by = uid;
  DELETE FROM public.calls WHERE caller_id = uid OR callee_id = uid;
  DELETE FROM public.blocked_users WHERE blocker_id = uid OR blocked_user_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid OR related_user_id = uid;
  DELETE FROM public.push_subscriptions WHERE user_id = uid;
  DELETE FROM public.support_tickets WHERE user_id = uid;
  DELETE FROM public.force_logout_tokens WHERE user_id = uid OR issued_by = uid;
  DELETE FROM public.user_profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_my_account(TEXT, TEXT) TO authenticated;

-- 7. Public appeal submission (token-based, no login) ---------------------
CREATE OR REPLACE FUNCTION public.submit_offboarding_appeal(
  _token TEXT,
  _reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_status TEXT;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN RAISE EXCEPTION 'Invalid token'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 10 THEN RAISE EXCEPTION 'Please explain your appeal (minimum 10 characters)'; END IF;

  SELECT id, status INTO v_id, v_status
    FROM public.offboarding_appeals WHERE token = _token;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Appeal link not found or expired'; END IF;
  IF v_status <> 'awaiting_submission' THEN
    RAISE EXCEPTION 'This appeal has already been submitted';
  END IF;

  UPDATE public.offboarding_appeals
    SET reason = trim(_reason), status = 'pending', submitted_at = now()
    WHERE id = v_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_offboarding_appeal(TEXT, TEXT) TO anon, authenticated, service_role;

-- Lookup helper for the public appeal page (returns only safe display fields)
CREATE OR REPLACE FUNCTION public.lookup_offboarding_appeal(_token TEXT)
RETURNS TABLE(status TEXT, appellant_name TEXT, reviewer_notes TEXT, reviewed_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status, appellant_name, reviewer_notes, reviewed_at
  FROM public.offboarding_appeals WHERE token = _token;
$$;
GRANT EXECUTE ON FUNCTION public.lookup_offboarding_appeal(TEXT) TO anon, authenticated, service_role;

-- 8. Admin review of offboarding appeal (approve unblocks) ----------------
CREATE OR REPLACE FUNCTION public.admin_review_offboarding_appeal(
  _appeal_id UUID,
  _decision TEXT,
  _notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  v_block_id UUID; v_status TEXT;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF _decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;

  SELECT block_id, status INTO v_block_id, v_status
    FROM public.offboarding_appeals WHERE id = _appeal_id;
  IF v_block_id IS NULL THEN RAISE EXCEPTION 'Appeal not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Appeal already reviewed'; END IF;

  UPDATE public.offboarding_appeals
    SET status = _decision, reviewer_id = actor, reviewer_notes = _notes, reviewed_at = now()
    WHERE id = _appeal_id;

  IF _decision = 'approved' THEN
    UPDATE public.blocked_signups
      SET unblocked_at = now(), unblocked_by = actor,
          notes = COALESCE(notes || E'\n', '') || 'Unblocked via appeal ' || _appeal_id::text
      WHERE id = v_block_id AND unblocked_at IS NULL;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_review_offboarding_appeal(UUID, TEXT, TEXT) TO authenticated, service_role;
