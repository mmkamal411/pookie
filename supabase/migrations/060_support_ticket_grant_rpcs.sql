-- Migration 060: support ticket/grant RPCs the app calls but that were never migrated
--
-- CONTEXT: three routes are coded RPC-first against contracts that exist
-- only in docs/squads/squad5/PENDING-MIGRATIONS.md (UNIT P1, "awaiting MD
-- renumbering") and docs/squads/squad5/BACKEND-CONTRACTS.md:
--   POST /api/v1/support/tickets/[id]/confirm -> rpc_user_confirm_resolution
--   POST /api/v1/support/tickets/[id]/reopen  -> rpc_user_reopen
--   POST /api/v1/support/grants/[id]/decision -> rpc_decide_support_grant
-- Until these land, the routes run their guarded service-client fallbacks.
-- This migration promotes the P1 drafts VERBATIM except where noted, so the
-- RPC-first path and the fallback path enforce the same contract.
--
-- SCOPE (deliberately minimal): only the three app-called RPCs plus their
-- direct dependencies (P1.0 columns, support_grant_consenter). The rest of
-- UNIT P1 (rpc_open_ticket, rpc_post_ticket_message, agent RPCs, credit
-- RPCs, sweeps) stays with Squad 5 to land after MD renumbering — every
-- statement here is idempotent, so the later full-unit landing cannot
-- conflict.
--
-- DELTA vs the P1 draft (reviewed, not duplicated):
--   1. rpc_user_reopen: the draft omits the BACKEND-CONTRACTS §D rule
--      "closed only <=30d" that the route's own fallback enforces. Added to
--      the UPDATE predicate so RPC-first and fallback agree.
--   2. rpc_decide_support_grant's audit calls use the 6-arg
--      log_access_event(child, actor, event, NULL, NULL, metadata) shape,
--      which 059 restores. Verified resolvable post-059.
--
-- REQUIRES: 032 (support_tickets, ticket_events), 033 (support_user_age_band),
--   034 (support_grants), 051/059 (log_access_event overloads).
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE / REVOKE+GRANT.
-- GRANT MODEL (P1 convention): EXECUTE on the RPCs for authenticated only
-- (service_role bypasses RLS anyway); support_grant_consenter also to
-- service_role for worker use.

-- P1.0 — additive columns (R-D). 032's table won the CREATE race; 033's
-- resolved_at/lead_review never materialized.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_review boolean NOT NULL DEFAULT false;

-- support_grant_consenter(): the data owner for a grant decision —
-- the linked teen (13+) for teen-owned data (sol-support C2), else the
-- ticket's user_id. Needed by rpc_decide_support_grant.
CREATE OR REPLACE FUNCTION public.support_grant_consenter(p_ticket_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_t    public.support_tickets%ROWTYPE;
  v_teen uuid;
BEGIN
  SELECT * INTO v_t FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_t.child_id IS NOT NULL THEN
    SELECT ca.user_id INTO v_teen FROM public.child_access ca
     WHERE ca.child_id = v_t.child_id AND ca.role = 'child' LIMIT 1;
    IF v_teen IS NOT NULL AND public.support_user_age_band(v_teen) = 'teen' THEN
      RETURN v_teen;
    END IF;
  END IF;
  RETURN v_t.user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.support_grant_consenter(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_grant_consenter(uuid) TO authenticated, service_role;

-- P1.5 — resolution handshake (user side): resolved -> closed.
CREATE OR REPLACE FUNCTION public.rpc_user_confirm_resolution(p_ticket_id uuid)
RETURNS TABLE (ticket_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  UPDATE public.support_tickets
     SET status = 'closed', closed_at = now()
   WHERE id = p_ticket_id AND user_id = v_uid AND status = 'resolved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket not found, not yours, or not resolved'
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.ticket_events (ticket_id, author_type, kind, body, metadata)
  VALUES (p_ticket_id, 'system', 'status_change', 'You confirmed the fix. Ticket closed — thanks!',
          jsonb_build_object('from', 'resolved', 'to', 'closed'));
  RETURN QUERY SELECT p_ticket_id, 'closed'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_user_confirm_resolution(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_user_confirm_resolution(uuid) TO authenticated;

-- P1.5 — user reopens: resolved|closed -> in_progress. Closed tickets are
-- only reopenable within 30 days of close (BACKEND-CONTRACTS §D; matches
-- the route's service-client fallback — the P1 draft omitted this guard).
CREATE OR REPLACE FUNCTION public.rpc_user_reopen(p_ticket_id uuid)
RETURNS TABLE (ticket_id uuid, status text, reopened_count int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_count int;
BEGIN
  UPDATE public.support_tickets
     SET status = 'in_progress',
         resolved_at = NULL,
         reopened_count = reopened_count + 1,
         lead_review = (reopened_count + 1 > 2)
   WHERE id = p_ticket_id AND user_id = v_uid
     AND (status = 'resolved'
          OR (status = 'closed' AND closed_at > now() - interval '30 days'))
  RETURNING support_tickets.reopened_count INTO v_count;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket not found, not yours, or not reopenable'
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.ticket_events (ticket_id, author_type, kind, body, metadata)
  VALUES (p_ticket_id, 'system', 'status_change', 'You reopened this ticket. We are on it again.',
          jsonb_build_object('to', 'in_progress', 'reopened_count', v_count));
  RETURN QUERY SELECT p_ticket_id, 'in_progress'::text, v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_user_reopen(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_user_reopen(uuid) TO authenticated;

-- P1.13 — rpc_decide_support_grant: data owner approves/denies. Approve ->
-- active 24h. The 034 CHECK (expires_at <= created_at + 72h) caps everything.
CREATE OR REPLACE FUNCTION public.rpc_decide_support_grant(p_grant_id uuid, p_approve boolean)
RETURNS TABLE (grant_id uuid, status text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_g   public.support_grants%ROWTYPE;
  v_consenter uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_g FROM public.support_grants WHERE id = p_grant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'grant not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_g.status <> 'pending' THEN
    RAISE EXCEPTION 'grant is not pending' USING ERRCODE = 'P0001';
  END IF;
  IF v_g.expires_at < now() THEN
    UPDATE public.support_grants SET status = 'expired' WHERE id = p_grant_id;
    RAISE EXCEPTION 'grant request expired' USING ERRCODE = 'P0001';
  END IF;
  v_consenter := public.support_grant_consenter(v_g.ticket_id);
  IF v_consenter IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'only the data owner can decide (the teen, for teen-owned data — sol-support C2)'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_approve THEN
    UPDATE public.support_grants
       SET status = 'active', consented_at = now(),
           expires_at = now() + interval '24 hours',
           granted_by_user_id = v_uid
     WHERE id = p_grant_id;
    PERFORM public.log_access_event(
      (SELECT child_id FROM public.support_tickets WHERE id = v_g.ticket_id),
      v_uid, 'support.grant.approved', NULL, NULL,
      jsonb_build_object('grant_id', p_grant_id, 'scope', v_g.scope));
  ELSE
    UPDATE public.support_grants
       SET status = 'denied', granted_by_user_id = v_uid
     WHERE id = p_grant_id;
    PERFORM public.log_access_event(
      (SELECT child_id FROM public.support_tickets WHERE id = v_g.ticket_id),
      v_uid, 'support.grant.denied', NULL, NULL,
      jsonb_build_object('grant_id', p_grant_id, 'scope', v_g.scope));
  END IF;

  RETURN QUERY SELECT p_grant_id,
    (SELECT status FROM public.support_grants WHERE id = p_grant_id),
    (SELECT expires_at FROM public.support_grants WHERE id = p_grant_id);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_decide_support_grant(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_decide_support_grant(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.rpc_decide_support_grant(uuid, boolean) IS
  'Support grant decision by the data owner (teen for teen-owned data). Approve -> active 24h; deny -> denied. Promoted from Squad 5 UNIT P1 by 060 (Squad 4 DB remediation); reopen 30-day guard added vs the draft.';
