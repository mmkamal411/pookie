-- Staged RPCs: grant / revoke authority matrix (Platform Team 1 Backend).
--
-- Fold into the renumbered migration that owns child_access.granted_by /
-- status (was 018). Depends on: 017 (profiles), 018-table-changes
-- (granted_by, granted_by_user_id, status, cooling_off_until, revoked_at,
-- re_request_locked_until), canonical 021 (access_events, log_access_event,
-- access_reason_codes incl. 00_reason_codes.sql), 023-table-changes
-- (child_access.expires_at, grant_kind, grant_purpose — referenced by
-- grant_access; must be applied before any call executes).
--
-- MD D6: tiered caps (trusted 8/30d, new 2/30d), teen co-approval
-- (pending_coapproval) for parent-granted NEW grantees on 13–15 teens.

-- ---------------------------------------------------------------------------
-- child_age_tier(p_child_id) -> under13 | t13_15 | t16_17 | adult | unknown
-- DOB-only. NULL DOB returns 'unknown' (fail closed); callers treat
-- 'unknown' as the most restrictive applicable tier. Emancipation override
-- (children.legal_status) is a later migration's integration point.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.child_age_tier(p_child_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dob date;
BEGIN
  SELECT c.date_of_birth INTO v_dob
    FROM public.children c
   WHERE c.id = p_child_id;

  IF v_dob IS NULL THEN
    RETURN 'unknown';
  END IF;
  IF v_dob > (current_date - INTERVAL '13 years')::date THEN
    RETURN 'under13';
  END IF;
  IF v_dob > (current_date - INTERVAL '16 years')::date THEN
    RETURN 't13_15';
  END IF;
  IF v_dob > (current_date - INTERVAL '18 years')::date THEN
    RETURN 't16_17';
  END IF;
  RETURN 'adult';
END;
$$;

REVOKE ALL ON FUNCTION public.child_age_tier(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.child_age_tier(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- grant_access(p_child_id, p_user_id, p_role, p_expires_at, p_grant_purpose)
--
-- AUTHORITY (fail closed): caller is the teen (active role='child' row,
-- tier 13+, known DOB) OR an active parent of the child. granted_by is
-- derived from the caller ('child'|'parent'), never from input.
-- p_role is 'parent' only — child-role links go through invite/claim/link.
-- A 'revoked' row is re-granted in place (PK is (child_id, user_id)).
-- 30-day re-request lockout: revoked rows with re_request_locked_until in
-- the future block non-teen re-grants (the teen may waive by re-granting).
--
-- D6 grantee tier: 'trusted' if ANY prior grant history for (child, grantee)
-- (a child_access row in any status, or a prior 'grant' access_event);
-- otherwise 'new'. ("Family" beyond grant history is not modeled in v1;
-- history is the trust proxy.)
-- D6 caps: trusted 8 / new 2 EFFECTIVE grants per rolling 30 days, counted
-- from access_events (reason teen_choice/regrant/coapproval_granted).
-- D6 co-approval: a PARENT granting a NEW grantee to a 13–15 teen (or
-- 'unknown' tier, fail closed) with an active teen row creates
-- status='pending_coapproval'. The teen completes it via approve_grant() /
-- decline_grant(). Trusted grantees, teen granters, 16–17, and
-- parent-managed (no teen row) profiles skip co-approval.
--
-- p_expires_at sets a timeboxed grant (grant_kind='occasion'); otherwise
-- indefinite. Writes access_events + audit_event. Returns true.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_access(
  p_child_id      uuid,
  p_user_id       uuid,
  p_role          text DEFAULT 'parent',
  p_expires_at    timestamptz DEFAULT NULL,
  p_grant_purpose text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       uuid := public.safe_auth_uid();
  v_tier         text;
  v_is_teen      boolean := false;
  v_is_parent    boolean := false;
  v_granted_by   text;
  v_row          public.child_access%ROWTYPE;
  v_regranted    boolean := false;
  v_grantee_tier text;
  v_cap          integer;
  v_recent       integer;
  v_grant_kind   text := 'indefinite';
  v_status       text := 'active';
  v_reason       text := 'teen_choice';
BEGIN
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF p_user_id  IS NULL THEN RAISE EXCEPTION 'grantee_required'; END IF;
  IF v_caller   IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_role IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION 'unsupported_grant_role';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'expiry_must_be_future';
  END IF;
  IF p_user_id = v_caller THEN
    RAISE EXCEPTION 'cannot_grant_self';
  END IF;
  IF p_expires_at IS NOT NULL THEN
    v_grant_kind := 'occasion';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'child' AND ca.status = 'active'
  ) INTO v_is_teen;

  IF v_is_teen THEN
    IF EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = p_child_id AND ca.user_id = p_user_id
         AND ca.role = 'child'
    ) THEN
      RAISE EXCEPTION 'cannot_grant_self';
    END IF;
    v_tier := public.child_age_tier(p_child_id);
    IF v_tier IN ('under13', 'unknown') THEN
      RAISE EXCEPTION 'age_verification_required';
    END IF;
    v_granted_by := 'child';
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
         AND ca.role = 'parent' AND ca.status = 'active'
    ) INTO v_is_parent;
    IF NOT v_is_parent THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
    v_granted_by := 'parent';
  END IF;

  SELECT * INTO v_row FROM public.child_access
   WHERE child_id = p_child_id AND user_id = p_user_id
   FOR UPDATE;

  IF FOUND THEN
    IF v_row.status IN ('active', 'scheduled_revoke') THEN
      RAISE EXCEPTION 'grant_already_active';
    END IF;
    IF v_row.status = 'pending_coapproval' THEN
      RAISE EXCEPTION 'grant_already_pending';
    END IF;
    IF NOT v_is_teen
       AND v_row.re_request_locked_until IS NOT NULL
       AND v_row.re_request_locked_until > now() THEN
      RAISE EXCEPTION 're_request_locked';
    END IF;
    v_regranted := true;
    v_reason := 'regrant';
  END IF;

  -- D6: grantee tier from prior grant history.
  SELECT CASE WHEN EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = p_child_id AND ca.user_id = p_user_id
    ) OR EXISTS (
      SELECT 1 FROM public.access_events ae
       WHERE ae.child_id = p_child_id AND ae.subject_user_id = p_user_id
         AND ae.event_type = 'grant'
    ) THEN 'trusted' ELSE 'new' END
  INTO v_grantee_tier;

  -- D6: tiered frequency caps on effective grants per rolling 30 days.
  v_cap := CASE WHEN v_grantee_tier = 'trusted' THEN 8 ELSE 2 END;
  SELECT count(*) INTO v_recent FROM public.access_events ae
   WHERE ae.child_id = p_child_id
     AND ae.subject_user_id = p_user_id
     AND ae.event_type = 'grant'
     AND ae.reason_code IN ('teen_choice', 'regrant', 'coapproval_granted')
     AND ae.created_at > now() - INTERVAL '30 days';
  IF v_recent >= v_cap THEN
    RAISE EXCEPTION 'grant_cap_exceeded';
  END IF;

  -- D6: teen co-approval for NEW grantees, parent granter, 13–15 only.
  IF NOT v_is_teen AND v_grantee_tier = 'new' THEN
    v_tier := public.child_age_tier(p_child_id);
    IF v_tier IN ('t13_15', 'unknown')
       AND EXISTS (
         SELECT 1 FROM public.child_access ca
          WHERE ca.child_id = p_child_id AND ca.role = 'child'
            AND ca.status = 'active'
       ) THEN
      v_status := 'pending_coapproval';
      v_reason := 'pending_coapproval';
    END IF;
  END IF;

  IF v_regranted THEN
    UPDATE public.child_access
       SET role = 'parent',
           status = v_status,
           granted_by = v_granted_by,
           granted_by_user_id = v_caller,
           revoked_at = NULL,
           cooling_off_until = NULL,
           re_request_locked_until = NULL,
           expires_at = p_expires_at,
           grant_kind = v_grant_kind,
           grant_purpose = p_grant_purpose
     WHERE child_id = p_child_id AND user_id = p_user_id;
  ELSE
    INSERT INTO public.child_access
      (child_id, user_id, role, granted_by, granted_by_user_id, status,
       expires_at, grant_kind, grant_purpose)
    VALUES
      (p_child_id, p_user_id, 'parent', v_granted_by, v_caller, v_status,
       p_expires_at, v_grant_kind, p_grant_purpose);
  END IF;

  PERFORM public.log_access_event(
    p_child_id, v_caller, 'grant', p_user_id, v_reason);

  PERFORM public.audit_event(p_child_id, 'access.granted', 'user',
                             'child_access', p_child_id::text || '/' || p_user_id::text,
                             jsonb_build_object('granted_to', p_user_id,
                                                'granted_by', v_granted_by,
                                                'regrant', v_regranted,
                                                'grantee_tier', v_grantee_tier,
                                                'status', v_status,
                                                'grant_kind', v_grant_kind));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_access(uuid, uuid, text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_access(uuid, uuid, text, timestamptz, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- revoke_access(p_child_id, p_user_id)
--
-- REVOKE MATRIX (server-side, in order):
--   A. row missing / not live            -> 'access_not_found'
--   B. row.role = 'child'                -> 'child_access_irrevocable'
--      (revoking the teen's own access is impossible by design)
--   C. caller == grantee (self-revoke)   -> ALLOW, instant
--   D. caller is the teen                -> ALLOW on any row
--        * 13–15 revoking a parent: status='scheduled_revoke',
--          cooling_off_until = now()+7d (notify hook: access_events row
--          event_type='cooling_off_started'; the notify fan-out reads it)
--        * 16+/adult: instant. 'unknown' tier fails closed -> cooling.
--   E. row.granted_by='parent' AND granted_by_user_id = caller -> ALLOW, instant
--   F. row.granted_by='child' AND caller is a parent
--                                         -> 'child_grant_untouchable' (DENY)
--   G. row.granted_by='parent', granter != caller -> 'not_your_grant' (DENY)
--   H. row.granted_by='system'           -> teen-only (DENY otherwise)
--   I. anything else                     -> 'not_authorized' (DENY)
-- Cancelling a 'pending_coapproval' row DELETES it (never took effect; the
-- ledger row is the record) — no lockout. Instant revokes set
-- re_request_locked_until = now()+30d (the teen may waive).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_access(
  p_child_id uuid,
  p_user_id  uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller    uuid := public.safe_auth_uid();
  v_row       public.child_access%ROWTYPE;
  v_is_teen   boolean := false;
  v_is_parent boolean := false;
  v_tier      text;
  v_cooling   boolean := false;
BEGIN
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF p_user_id  IS NULL THEN RAISE EXCEPTION 'grantee_required'; END IF;
  IF v_caller   IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  SELECT * INTO v_row FROM public.child_access
   WHERE child_id = p_child_id AND user_id = p_user_id
     AND status IN ('active', 'scheduled_revoke', 'pending_coapproval')
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'access_not_found';
  END IF;

  IF v_row.role = 'child' THEN
    RAISE EXCEPTION 'child_access_irrevocable';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'child' AND ca.status = 'active'
  ) INTO v_is_teen;

  SELECT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'parent' AND ca.status = 'active'
  ) INTO v_is_parent;

  IF v_caller = p_user_id THEN
    NULL; -- (C) Self-revoke: always allowed, instant.
  ELSIF v_is_teen THEN
    v_tier := public.child_age_tier(p_child_id);
    IF v_tier IN ('t13_15', 'unknown') THEN
      v_cooling := true; -- 'unknown' fails closed into cooling.
    END IF;
  ELSIF v_row.granted_by = 'parent' AND v_row.granted_by_user_id = v_caller THEN
    NULL; -- (E) Parents revoke only their own grants.
  ELSIF v_row.granted_by = 'child' AND v_is_parent THEN
    RAISE EXCEPTION 'child_grant_untouchable'; -- (F)
  ELSIF v_row.granted_by = 'parent' THEN
    RAISE EXCEPTION 'not_your_grant'; -- (G)
  ELSIF v_row.granted_by = 'system' THEN
    RAISE EXCEPTION 'not_authorized'; -- (H)
  ELSE
    RAISE EXCEPTION 'not_authorized'; -- (I) Fail closed.
  END IF;

  IF v_row.status = 'pending_coapproval' THEN
    DELETE FROM public.child_access
     WHERE child_id = p_child_id AND user_id = p_user_id;
    PERFORM public.log_access_event(
      p_child_id, v_caller, 'revoke_cancelled', p_user_id, 'teen_choice');
    PERFORM public.audit_event(p_child_id, 'access.revoked', 'user',
                               'child_access', p_child_id::text || '/' || p_user_id::text,
                               jsonb_build_object('revoked_user', p_user_id,
                                                  'pending_cancelled', true));
    RETURN true;
  END IF;

  IF v_cooling THEN
    UPDATE public.child_access
       SET status = 'scheduled_revoke',
           cooling_off_until = now() + INTERVAL '7 days'
     WHERE child_id = p_child_id AND user_id = p_user_id;
    PERFORM public.log_access_event(
      p_child_id, v_caller, 'cooling_off_started', p_user_id, 'teen_choice');
  ELSE
    UPDATE public.child_access
       SET status = 'revoked',
           revoked_at = now(),
           cooling_off_until = NULL,
           re_request_locked_until = now() + INTERVAL '30 days'
     WHERE child_id = p_child_id AND user_id = p_user_id;
    PERFORM public.log_access_event(
      p_child_id, v_caller, 'revoke_effective', p_user_id, 'teen_choice');
  END IF;

  PERFORM public.audit_event(p_child_id, 'access.revoked', 'user',
                             'child_access', p_child_id::text || '/' || p_user_id::text,
                             jsonb_build_object('revoked_user', p_user_id,
                                                'cooling', v_cooling));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_access(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- approve_grant(p_child_id, p_user_id) / decline_grant(p_child_id, p_user_id)
-- D6 teen co-approval completion. TEEN-ONLY: the caller must hold the active
-- role='child' row; a parent cannot approve their own pending grant.
-- approve re-checks the D6 cap. decline DELETES the provisional row (never
-- took effect; no lockout).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_grant(
  p_child_id uuid,
  p_user_id  uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller  uuid := public.safe_auth_uid();
  v_row     public.child_access%ROWTYPE;
  v_recent  integer;
  v_cap     integer;
BEGIN
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF p_user_id  IS NULL THEN RAISE EXCEPTION 'grantee_required'; END IF;
  IF v_caller   IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'child' AND ca.status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_row FROM public.child_access
   WHERE child_id = p_child_id AND user_id = p_user_id
     AND status = 'pending_coapproval'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'grant_not_pending';
  END IF;

  SELECT CASE WHEN EXISTS (
      SELECT 1 FROM public.access_events ae
       WHERE ae.child_id = p_child_id AND ae.subject_user_id = p_user_id
         AND ae.event_type = 'grant'
    ) THEN 8 ELSE 2 END INTO v_cap;
  SELECT count(*) INTO v_recent FROM public.access_events ae
   WHERE ae.child_id = p_child_id
     AND ae.subject_user_id = p_user_id
     AND ae.event_type = 'grant'
     AND ae.reason_code IN ('teen_choice', 'regrant', 'coapproval_granted')
     AND ae.created_at > now() - INTERVAL '30 days';
  IF v_recent >= v_cap THEN
    RAISE EXCEPTION 'grant_cap_exceeded';
  END IF;

  UPDATE public.child_access
     SET status = 'active'
   WHERE child_id = p_child_id AND user_id = p_user_id;

  PERFORM public.log_access_event(
    p_child_id, v_caller, 'grant', p_user_id, 'coapproval_granted');
  PERFORM public.audit_event(p_child_id, 'access.granted', 'user',
                             'child_access', p_child_id::text || '/' || p_user_id::text,
                             jsonb_build_object('granted_to', p_user_id,
                                                'coapproved_by_teen', true));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_grant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_grant(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.decline_grant(
  p_child_id uuid,
  p_user_id  uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
BEGIN
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF p_user_id  IS NULL THEN RAISE EXCEPTION 'grantee_required'; END IF;
  IF v_caller   IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'child' AND ca.status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM public.child_access
   WHERE child_id = p_child_id AND user_id = p_user_id
     AND status = 'pending_coapproval';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'grant_not_pending';
  END IF;

  PERFORM public.log_access_event(
    p_child_id, v_caller, 'revoke_cancelled', p_user_id, 'coapproval_declined');
  PERFORM public.audit_event(p_child_id, 'access.revoked', 'user',
                             'child_access', p_child_id::text || '/' || p_user_id::text,
                             jsonb_build_object('declined_user', p_user_id,
                                                'coapproval_declined', true));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.decline_grant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_grant(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- go_independent(p_child_id) -> jsonb
-- Spec §6 "Go independent" (13–17). Teen-only. Graduation framing, not
-- punishment: the teen gains a full personal Pookie.
--   13–15 : every active parent row -> status='scheduled_revoke' with a
--           7-day cooling_off_until (cancellable via revoke_access paths).
--   16–17 : instant revoke of every active parent row (reversible by teen).
--   under13 / unknown -> 'not_eligible'. 18+ -> 'use_graduate_flow'
--           (015's graduate_child_access owns the adult transition).
-- Returns {mode: 'cooling'|'instant', affected: n, effective_at}.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.go_independent(p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   uuid := public.safe_auth_uid();
  v_tier     text;
  v_affected integer := 0;
  r          public.child_access%ROWTYPE;
BEGIN
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF v_caller   IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'child' AND ca.status = 'active'
  ) THEN
    RAISE EXCEPTION 'child_membership_required';
  END IF;

  v_tier := public.child_age_tier(p_child_id);
  IF v_tier IN ('under13', 'unknown') THEN
    RAISE EXCEPTION 'not_eligible';
  END IF;
  IF v_tier = 'adult' THEN
    RAISE EXCEPTION 'use_graduate_flow';
  END IF;

  FOR r IN
    SELECT * FROM public.child_access
     WHERE child_id = p_child_id
       AND role = 'parent'
       AND status = 'active'
     FOR UPDATE
  LOOP
    IF v_tier = 't13_15' THEN
      UPDATE public.child_access
         SET status = 'scheduled_revoke',
             cooling_off_until = now() + INTERVAL '7 days'
       WHERE child_id = r.child_id AND user_id = r.user_id;
      PERFORM public.log_access_event(
        p_child_id, v_caller, 'cooling_off_started', r.user_id, 'teen_choice');
    ELSE
      UPDATE public.child_access
         SET status = 'revoked',
             revoked_at = now(),
             cooling_off_until = NULL,
             re_request_locked_until = now() + INTERVAL '30 days'
       WHERE child_id = r.child_id AND user_id = r.user_id;
      PERFORM public.log_access_event(
        p_child_id, v_caller, 'revoke_effective', r.user_id, 'teen_choice');
    END IF;
    v_affected := v_affected + 1;
  END LOOP;

  PERFORM public.log_access_event(
    p_child_id, v_caller, 'go_independent', v_caller, 'teen_choice',
    jsonb_build_object('mode', CASE WHEN v_tier = 't13_15'
                                    THEN 'cooling' ELSE 'instant' END,
                       'affected_parents', v_affected));
  PERFORM public.audit_event(p_child_id, 'access.go_independent', 'user',
                             'child_access', p_child_id::text,
                             jsonb_build_object('affected_parents', v_affected,
                                                'tier', v_tier));

  RETURN jsonb_build_object(
    'mode', CASE WHEN v_tier = 't13_15' THEN 'cooling' ELSE 'instant' END,
    'affected', v_affected,
    'effective_at', CASE WHEN v_tier = 't13_15'
                         THEN (now() + INTERVAL '7 days')::text
                         ELSE now()::text END);
END;
$$;

REVOKE ALL ON FUNCTION public.go_independent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.go_independent(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- apply_cooling_off_revocations() -> integer
-- Daily cron (service_role only). Rows whose 7-day cooling elapsed become
-- 'revoked' (+ 30-day re-request lockout). One ledger row per revocation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_cooling_off_revocations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r         public.child_access%ROWTYPE;
  v_count   integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.child_access
     WHERE status = 'scheduled_revoke'
       AND cooling_off_until IS NOT NULL
       AND cooling_off_until <= now()
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.child_access
       SET status = 'revoked',
           revoked_at = now(),
           cooling_off_until = NULL,
           re_request_locked_until = now() + INTERVAL '30 days'
     WHERE child_id = r.child_id AND user_id = r.user_id;
    PERFORM public.log_access_event(
      r.child_id, NULL, 'revoke_effective', r.user_id, 'cooling_off_expired');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_cooling_off_revocations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_cooling_off_revocations() TO service_role;
