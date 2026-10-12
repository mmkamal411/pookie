-- Migration 058: go_independent() ("Go independent" teen flow) + timeboxed-grant sweep index
--
-- CONTEXT: two leftover pieces of the staged access model
-- (supabase/functions/staged-access-rpcs/) that never landed in a migration.
--
--   1. go_independent(p_child_id) -> jsonb — the locked "Go independent" product
--      flow (2026-10-12): graduation framing, not punishment. Teen-only.
--        13-15 : every active parent row -> status='scheduled_revoke' with a
--                7-day cooling_off_until (cancellable via revoke_access paths).
--        16-17 : instant revoke of every active parent row (reversible by teen).
--        under13 / unknown -> 'not_eligible'. 18+ -> 'use_graduate_flow'
--                (015's graduate_child_access owns the adult transition).
--      Returns {mode: 'cooling'|'instant', affected: n, effective_at}.
--      Source: staged 01_grant_revoke.sql (spec section 6). The rest of that
--      file's RPCs already live in 018/030/031; this was the only missing one.
--   2. child_access_expiry_sweep_idx — the partial index the staged timeboxed
--      design (05_timeboxed.sql) calls for. 030's expire_timeboxed_grants()
--      sweeps WHERE grant_kind='timeboxed' AND status='active' AND
--      expires_at <= now(); without the index that sweep is a seq scan.
--
-- REQUIRES: 018 (child_access.status, cooling_off_until, revoked_at,
-- re_request_locked_until, child_age_tier), 021 (log_access_event,
-- access_reason_codes incl. 'teen_choice'), 004 (audit_event),
-- 030 (grant_kind, expires_at, expire_timeboxed_grants).
--
-- IDEMPOTENT: CREATE OR REPLACE / CREATE INDEX IF NOT EXISTS / REVOKE+GRANT.
-- Safe to re-run.

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
      -- Canonical 8-arg log_access_event (051): (child, actor, subject,
      -- event, granted_by, reason, device_hash, ip_hash).
      PERFORM public.log_access_event(
        p_child_id, v_caller, r.user_id, 'cooling_off_started',
        r.granted_by, 'teen_choice', NULL, NULL);
    ELSE
      UPDATE public.child_access
         SET status = 'revoked',
             revoked_at = now(),
             cooling_off_until = NULL,
             re_request_locked_until = now() + INTERVAL '30 days'
       WHERE child_id = r.child_id AND user_id = r.user_id;
      PERFORM public.log_access_event(
        p_child_id, v_caller, r.user_id, 'revoke_effective',
        r.granted_by, 'teen_choice', NULL, NULL);
    END IF;
    v_affected := v_affected + 1;
  END LOOP;

  -- Summary event (canonical 8-arg form; mode/affected detail rides on the
  -- audit_event row below — the canonical signature carries no metadata).
  PERFORM public.log_access_event(
    p_child_id, v_caller, v_caller, 'go_independent',
    'child', 'teen_choice', NULL, NULL);
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
-- Timeboxed-grant expiry sweep index (staged 05_timeboxed.sql)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS child_access_expiry_sweep_idx
  ON public.child_access (expires_at)
  WHERE grant_kind = 'timeboxed' AND status = 'active' AND expires_at IS NOT NULL;
