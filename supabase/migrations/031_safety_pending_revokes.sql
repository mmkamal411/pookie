-- Migration 031: pending revokes + safety revoke RPCs (Squad 1 Safety Track)
--
-- CONTEXT: sol-safety.md §3 (G4 cooling-off redesign), FR-SAFETY-004/005.
-- Numbering: per APPLY_ORDER.md collision directive (Squad 1 -> 026+).
--
-- RELATIONSHIP TO 018/025: the grant-state columns live on child_access
-- (018's status/cooling_off_until; 025's notify_mode, safe_exit,
-- frozen_view_at, trusted_adult_user_id/declined, revoke_reason_code).
-- This migration adds the SAFETY WORKFLOW layer on top:
--   1. children.parent_sync_frozen_until: freeze flag for parent-visible
--      pipelines. See SYNC-WORKER CONTRACT below.
--   2. pending_revokes: workflow ledger for the safety revoke flow
--      (scheduling, notify-mode tracking, trusted-adult gate proof,
--      safe-exit suppression). The grant mutation itself stays on
--      child_access; this table is the safety squad's orchestration record.
--   3. apply_cooling_off_revocations() redefined: rows with an OPEN
--      pending_revokes entry are SKIPPED (deferred to rpc_execute_revoke,
--      which owns notification timing). Additive guard only.
--   4. RPCs: rpc_initiate_revoke / rpc_cancel_revoke / rpc_execute_revoke
--      (service_role cron) / rpc_safe_exit / rpc_regrant_access /
--      rpc_revoke_gate_status.
--
-- SAFETY PROPERTIES (sol-safety §3.1, enforced here):
--   * Default = notify at effect, only the revoked parent, never both.
--   * Parent UI shows access UNCHANGED during pending (grant row stays live
--     until effect; frozen_view_at pins their visible snapshot).
--   * No new parent-visible syncs during the window (parent_sync_frozen_until).
--   * Safe-exit: immediate cutoff, suppressed notification, visually boring.
--
-- SYNC-WORKER CONTRACT (parent_sync_frozen_until):
--   Workers MUST read children.parent_sync_frozen_until before ANY
--   parent-destined write (grades, digests, notifications, dashboard pushes).
--   - NULL                    -> not frozen; proceed normally.
--   - timestamp in the future -> FROZEN: skip all parent-destined writes for
--     this child. Already-pulled data stays as-is; nothing new flows.
--   - 'infinity'              -> frozen until the teen re-grants (safe-exit).
--   Additionally (FR-SAFETY-006): a revoked parent's credentials must never
--   keep syncing the teen's data — workers must join child_access and skip
--   grantees whose status <> 'active'. The teen's own data-source handoff
--   (reconnecting school creds under the teen) is a separate flow.
--
-- IDEMPOTENT: IF NOT EXISTS / constraint guards / CREATE OR REPLACE.
--
-- GRANT MODEL (015 convention): RLS grants nothing new. New EXECUTE surface:
-- the five revoke RPCs + rpc_revoke_gate_status for authenticated
-- (+ service_role); rpc_execute_revoke for service_role only.

-- ---------------------------------------------------------------------------
-- Part 1 — children.parent_sync_frozen_until
-- ---------------------------------------------------------------------------
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS parent_sync_frozen_until timestamptz;

COMMENT ON COLUMN public.children.parent_sync_frozen_until IS
  'SYNC-WORKER CONTRACT: workers skip all parent-destined writes for this child while this is in the future. NULL = not frozen. infinity = frozen until teen re-grants (safe-exit). Set at revoke-initiation, cleared on cancel/re-grant.';

-- ---------------------------------------------------------------------------
-- Part 2 — pending_revokes workflow ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pending_revokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  grantee_user_id uuid NOT NULL REFERENCES auth.users(id),
  scopes_removed text[] NOT NULL DEFAULT '{}',
  initiated_at timestamptz NOT NULL DEFAULT now(),
  effect_at timestamptz NOT NULL,
  notify_mode text NOT NULL CHECK (notify_mode IN ('at_effect', 'immediate', 'suppressed')),
  notification_sent_at timestamptz,
  safe_exit boolean NOT NULL DEFAULT false,
  gate_proof jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'effected', 'cancelled')),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_revokes_due_idx
  ON public.pending_revokes (status, effect_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS pending_revokes_child_idx
  ON public.pending_revokes (child_id, grantee_user_id);

COMMENT ON TABLE public.pending_revokes IS
  'Safety revoke workflow ledger (sol-safety §3.4). The grant mutation lives on child_access; this table tracks scheduling (effect_at), notification timing (notify_mode/notification_sent_at), the trusted-adult gate proof, and safe-exit suppression. v1 revokes always remove the whole grant; scopes_removed records teen intent for the future scope model.';

ALTER TABLE public.pending_revokes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pending_revokes_teen_read ON public.pending_revokes;
CREATE POLICY pending_revokes_teen_read ON public.pending_revokes
  FOR SELECT TO authenticated
  USING (
    -- Inlined (not public.is_teen_of()): the helper lives in
    -- 048_safety_trusted_adults.sql, which sorts after this file.
    EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = pending_revokes.child_id
         AND ca.user_id = public.safe_auth_uid()
         AND ca.role = 'child'
         AND ca.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- Part 3 — revoke-gate status (trusted-adult requirement, FR-SAFETY-001)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_revoke_gate_status(p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_adult_id uuid;
  v_declined boolean := false;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF NOT public.is_teen_of(p_child_id) THEN RAISE EXCEPTION 'teen_only'; END IF;

  SELECT ta.id INTO v_adult_id FROM public.trusted_adults ta
   WHERE ta.child_id = p_child_id
     AND ta.is_active
     AND ta.verification_status = 'verified'
     AND 'revoke_guardian' = ANY (ta.roles)
   ORDER BY ta.priority LIMIT 1;

  SELECT EXISTS (
    SELECT 1 FROM public.access_events ae
     WHERE ae.child_id = p_child_id
       AND ae.event_type = 'crisis_alert.declined_path'
  ) INTO v_declined;

  RETURN jsonb_build_object(
    'satisfied', (v_adult_id IS NOT NULL OR v_declined),
    'via', CASE WHEN v_adult_id IS NOT NULL THEN 'trusted_adult'
                WHEN v_declined THEN 'declined_path'
                ELSE 'none' END,
    'trusted_adult_id', v_adult_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_revoke_gate_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_gate_status(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 4 — apply_cooling_off_revocations() redefined (defer to safety flow)
-- Rows with an OPEN pending_revokes entry are skipped here; the safety
-- flow's rpc_execute_revoke owns their effect timing + notification.
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
       AND NOT EXISTS (
         SELECT 1 FROM public.pending_revokes pr
          WHERE pr.child_id = child_access.child_id
            AND pr.grantee_user_id = child_access.user_id
            AND pr.status = 'pending')
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.child_access
       SET status = 'revoked',
           revoked_at = now(),
           cooling_off_until = NULL,
           re_request_locked_until = now() + INTERVAL '30 days'
     WHERE child_id = r.child_id AND user_id = r.user_id;
    PERFORM public.log_access_event(
      r.child_id, NULL, r.user_id, 'revoke', r.granted_by,
      'cooling_off_expired', NULL, NULL);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_cooling_off_revocations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_cooling_off_revocations() TO service_role;

-- ---------------------------------------------------------------------------
-- Part 5 — rpc_initiate_revoke
-- Teen starts the safety revoke flow. Enforces the trusted-adult gate
-- (FR-SAFETY-001), records notify_mode, freezes parent-visible syncs, and
-- delegates the grant-state change to revoke_access() (018/030 tier logic).
-- INTEGRATION POINT: notification DELIVERY (push/SMS/email) is the notify
-- fan-out workstream; it reads access_events rows carrying notify_mode.
-- This RPC records intent + timing; it does not deliver (same split as
-- 001's access_requests: "notification delivery is a LATER workstream").
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_initiate_revoke(
  p_child_id uuid,
  p_grantee_user_id uuid,
  p_notify_mode text,
  p_scopes_removed text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_tier text;
  v_gate jsonb;
  v_row public.child_access%ROWTYPE;
  v_pending_id uuid;
  v_adult_id uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF p_grantee_user_id IS NULL THEN RAISE EXCEPTION 'grantee_required'; END IF;
  IF NOT public.is_teen_of(p_child_id) THEN RAISE EXCEPTION 'teen_only'; END IF;
  v_tier := public.child_age_tier(p_child_id);
  IF v_tier IN ('under13', 'unknown') THEN RAISE EXCEPTION 'age_verification_required'; END IF;
  IF p_notify_mode NOT IN ('at_effect', 'immediate') THEN
    RAISE EXCEPTION 'invalid_notify_mode';
  END IF;

  -- Trusted-adult gate (FR-SAFETY-001): a verified revoke_guardian adult or
  -- a recorded informed decline must exist before any revoke executes.
  v_gate := public.rpc_revoke_gate_status(p_child_id);
  IF NOT (v_gate ->> 'satisfied')::boolean THEN
    RAISE EXCEPTION 'trusted_adult_required';
  END IF;
  v_adult_id := NULLIF(v_gate ->> 'trusted_adult_id', '')::uuid;

  -- The grant-state change (tier logic: cooling vs instant lives here).
  PERFORM public.revoke_access(p_child_id, p_grantee_user_id);

  SELECT * INTO v_row FROM public.child_access
   WHERE child_id = p_child_id AND user_id = p_grantee_user_id;

  IF v_row.status = 'scheduled_revoke' THEN
    -- Cooling path (13-15): parent UI stays UNCHANGED during pending; the
    -- visible snapshot is pinned at frozen_view_at; syncs freeze at effect.
    INSERT INTO public.pending_revokes
      (child_id, grantee_user_id, scopes_removed, effect_at, notify_mode,
       notification_sent_at, gate_proof, status)
    VALUES
      (p_child_id, p_grantee_user_id, COALESCE(p_scopes_removed, '{}'),
       v_row.cooling_off_until, p_notify_mode,
       CASE WHEN p_notify_mode = 'immediate' THEN now() ELSE NULL END,
       jsonb_build_object('via', v_gate ->> 'via', 'trusted_adult_id', v_adult_id),
       'pending')
    RETURNING id INTO v_pending_id;

    UPDATE public.child_access
       SET notify_mode = p_notify_mode,
           frozen_view_at = now(),
           cooling_off_started_at = now(),
           trusted_adult_user_id = v_adult_id,
           trusted_adult_declined = ((v_gate ->> 'via') = 'declined_path')
     WHERE child_id = p_child_id AND user_id = p_grantee_user_id;

    UPDATE public.children
       SET parent_sync_frozen_until = v_row.cooling_off_until
     WHERE id = p_child_id;

    PERFORM public.log_access_event(
      p_child_id, v_caller, p_grantee_user_id, 'revoke_initiated',
      v_row.granted_by, 'teen_choice', NULL,
      jsonb_build_object('notify_mode', p_notify_mode,
                         'effect_at', v_row.cooling_off_until,
                         'gate_via', v_gate ->> 'via'));
  ELSE
    -- Instant path (16-17): effect now, notify per the teen's choice.
    INSERT INTO public.pending_revokes
      (child_id, grantee_user_id, scopes_removed, effect_at, notify_mode,
       notification_sent_at, gate_proof, status)
    VALUES
      (p_child_id, p_grantee_user_id, COALESCE(p_scopes_removed, '{}'),
       now(), p_notify_mode, now(),
       jsonb_build_object('via', v_gate ->> 'via', 'trusted_adult_id', v_adult_id),
       'effected')
    RETURNING id INTO v_pending_id;

    PERFORM public.log_access_event(
      p_child_id, v_caller, p_grantee_user_id, 'revoke_effective',
      v_row.granted_by, 'teen_choice', NULL,
      jsonb_build_object('notify_mode', p_notify_mode,
                         'gate_via', v_gate ->> 'via'));
  END IF;

  RETURN jsonb_build_object(
    'pending_revoke_id', v_pending_id,
    'status', v_row.status,
    'effect_at', v_row.cooling_off_until,
    'notify_mode', p_notify_mode);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_initiate_revoke(uuid, uuid, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_initiate_revoke(uuid, uuid, text, text[])
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 6 — rpc_cancel_revoke
-- Teen cancels during pending: grant restored, freeze lifted, parent never
-- knew (nothing ever changed for them).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_cancel_revoke(p_pending_revoke_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_pr public.pending_revokes%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_pending_revoke_id IS NULL THEN RAISE EXCEPTION 'pending_revoke_required'; END IF;

  SELECT * INTO v_pr FROM public.pending_revokes
   WHERE id = p_pending_revoke_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pending_revoke_not_found'; END IF;
  IF v_pr.status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'revoke_not_pending'; END IF;
  IF NOT public.is_teen_of(v_pr.child_id) THEN RAISE EXCEPTION 'teen_only'; END IF;
  IF v_pr.safe_exit THEN RAISE EXCEPTION 'safe_exit_not_cancellable'; END IF;

  UPDATE public.pending_revokes
     SET status = 'cancelled', cancelled_at = now()
   WHERE id = p_pending_revoke_id;

  UPDATE public.child_access
     SET status = 'active',
         cooling_off_until = NULL,
         cooling_off_started_at = NULL,
         frozen_view_at = NULL,
         notify_mode = 'at_effect'
   WHERE child_id = v_pr.child_id AND user_id = v_pr.grantee_user_id;

  UPDATE public.children
     SET parent_sync_frozen_until = NULL
   WHERE id = v_pr.child_id;

  PERFORM public.log_access_event(
    v_pr.child_id, v_caller, v_pr.grantee_user_id, 'revoke_cancelled',
    'child', 'cooling_off_cancelled', NULL, NULL);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cancel_revoke(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_revoke(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 7 — rpc_execute_revoke (service_role cron: the effector)
-- Finalizes due pending revokes: grant -> revoked, notification intent per
-- notify_mode. Owns rows that apply_cooling_off_revocations() skips (Part 4).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_execute_revoke()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
  pr public.pending_revokes%ROWTYPE;
  v_count integer := 0;
BEGIN
  IF v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_only';
  END IF;

  FOR pr IN
    SELECT * FROM public.pending_revokes
     WHERE status = 'pending' AND effect_at <= now()
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.child_access
       SET status = 'revoked',
           revoked_at = now(),
           revoked_by = NULL,
           revoke_reason_code = 'cooling_off_expired',
           cooling_off_until = NULL,
           cooling_off_started_at = NULL,
           frozen_view_at = NULL,
           re_request_locked_until = now() + INTERVAL '30 days'
     WHERE child_id = pr.child_id AND user_id = pr.grantee_user_id;

    UPDATE public.pending_revokes
       SET status = 'effected',
           notification_sent_at = CASE WHEN pr.notify_mode = 'at_effect'
                                       THEN now() ELSE notification_sent_at END
     WHERE id = pr.id;

    UPDATE public.children
       SET parent_sync_frozen_until = NULL
     WHERE id = pr.child_id;

    PERFORM public.log_access_event(
      pr.child_id, NULL, pr.grantee_user_id, 'revoke_effective', 'system',
      'cooling_off_expired', NULL,
      jsonb_build_object('notify_mode', pr.notify_mode,
                         'pending_revoke_id', pr.id));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_execute_revoke() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_execute_revoke() TO service_role;

-- ---------------------------------------------------------------------------
-- Part 8 — rpc_safe_exit (immediate, suppressed, visually boring)
-- "Telling my parents about this could put me at risk": access ends NOW, no
-- notification is ever sent (not delayed — suppressed), parent-visible syncs
-- freeze permanently (infinity) until the teen re-grants. FR-SAFETY-004:
-- safe exits are visually boring — no celebration UI where an abuser might
-- see the screen (client obligation; the RPC returns no fanfare payload).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_safe_exit(
  p_child_id uuid,
  p_grantee_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_tier text;
  v_gate jsonb;
  v_row public.child_access%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF p_grantee_user_id IS NULL THEN RAISE EXCEPTION 'grantee_required'; END IF;
  IF NOT public.is_teen_of(p_child_id) THEN RAISE EXCEPTION 'teen_only'; END IF;
  v_tier := public.child_age_tier(p_child_id);
  IF v_tier IN ('under13', 'unknown') THEN RAISE EXCEPTION 'age_verification_required'; END IF;

  v_gate := public.rpc_revoke_gate_status(p_child_id);
  IF NOT (v_gate ->> 'satisfied')::boolean THEN
    RAISE EXCEPTION 'trusted_adult_required';
  END IF;

  SELECT * INTO v_row FROM public.child_access
   WHERE child_id = p_child_id AND user_id = p_grantee_user_id
     AND role = 'parent'
     AND status IN ('active', 'scheduled_revoke', 'pending_cooling', 'pending_coapproval')
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'access_not_found'; END IF;

  -- Immediate cutoff: bypasses the cooling window at every age tier.
  UPDATE public.child_access
     SET status = 'revoked',
         revoked_at = now(),
         revoked_by = v_caller,
         revoke_reason_code = 'safe_exit_risk',
         safe_exit = true,
         notify_mode = 'suppressed',
         cooling_off_until = NULL,
         cooling_off_started_at = NULL,
         frozen_view_at = NULL,
         re_request_locked_until = now() + INTERVAL '30 days'
   WHERE child_id = p_child_id AND user_id = p_grantee_user_id;

  -- Anti-coercion: zero every scope on the revoked grant (025 helper).
  PERFORM public.zero_access_scopes(p_child_id, p_grantee_user_id);

  INSERT INTO public.pending_revokes
    (child_id, grantee_user_id, effect_at, notify_mode, safe_exit,
     gate_proof, status)
  VALUES
    (p_child_id, p_grantee_user_id, now(), 'suppressed', true,
     jsonb_build_object('via', v_gate ->> 'via'), 'effected');

  UPDATE public.children
     SET parent_sync_frozen_until = 'infinity'
   WHERE id = p_child_id;

  -- Teen-visible ONLY. 021's RLS restricts access_events SELECT to the teen;
  -- this event never appears on a parent-facing surface (§3, checklist §1.3.6).
  PERFORM public.log_access_event(
    p_child_id, v_caller, p_grantee_user_id, 'safe_exit', v_row.granted_by,
    'safe_exit_risk', NULL,
    jsonb_build_object('gate_via', v_gate ->> 'via'));

  RETURN jsonb_build_object('safe_exit', true, 'effected_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_safe_exit(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_safe_exit(uuid, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 9 — rpc_regrant_access (teen re-grants after revoke / safe-exit)
-- Funnels through grant_access() (030: D6 caps + lockout waiver for the teen).
-- Clears the sync freeze. Post-safe-exit anti-coercion confirm is client-side.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_regrant_access(
  p_child_id uuid,
  p_grantee_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_tier text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF p_grantee_user_id IS NULL THEN RAISE EXCEPTION 'grantee_required'; END IF;
  IF NOT public.is_teen_of(p_child_id) THEN RAISE EXCEPTION 'teen_only'; END IF;
  v_tier := public.child_age_tier(p_child_id);
  IF v_tier IN ('under13', 'unknown') THEN RAISE EXCEPTION 'age_verification_required'; END IF;

  PERFORM public.grant_access(p_child_id, p_grantee_user_id, 'parent');

  UPDATE public.child_access
     SET safe_exit = false, notify_mode = 'at_effect'
   WHERE child_id = p_child_id AND user_id = p_grantee_user_id;

  UPDATE public.children
     SET parent_sync_frozen_until = NULL
   WHERE id = p_child_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_regrant_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_regrant_access(uuid, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. Gate unsatisfied -> initiate raises trusted_adult_required.
-- 2. 13-15 initiate with verified revoke_guardian -> scheduled_revoke,
--    pending_revokes pending, parent_sync_frozen_until set, notify at_effect.
-- 3. Cancel -> active, freeze NULL, revoke_cancelled logged.
-- 4. rpc_execute_revoke past effect_at -> revoked, revoke_effective logged.
-- 5. safe_exit -> immediate revoked, notify suppressed, freeze = infinity,
--    zero scopes; regrant -> active, freeze cleared.
-- 6. check.sh passes.
