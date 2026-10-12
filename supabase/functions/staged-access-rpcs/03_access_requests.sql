-- Staged RPCs: access requests (Platform Team 1 Backend).
--
-- Fold into the renumbered migration that owns access_requests (was 020).
-- Depends on: 018-table-changes (child_access incl. re_request_locked_until),
-- 01_grant_revoke.sql (grant_access), canonical 021 (access_events,
-- log_access_event, access_reason_codes incl. 00_reason_codes.sql).
--
-- D5: request_access() is approval-gated, NOT an auto-grant claim path.
-- No custody-order enforcement here (manual court-order queue only).

-- ---------------------------------------------------------------------------
-- request_access(p_child_id) -> uuid
-- Creates a pending access request for the CALLER. Fail closed:
--   not the teen's own record, no live access row, and the 30-DAY
--   RE-REQUEST LOCKOUT enforced HERE (not just app-side):
--     (a) revoked child_access row with re_request_locked_until in the future
--     (b) denied request with reviewed_at within the last 30 days
-- Only the teen may waive the lock early (Sharing screen, later work).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_access(p_child_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_req_id uuid;
BEGIN
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.children WHERE id = p_child_id) THEN
    RAISE EXCEPTION 'child_not_found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'child'
  ) THEN
    RAISE EXCEPTION 'cannot_request_own';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.status IN ('active', 'scheduled_revoke')
  ) THEN
    RAISE EXCEPTION 'access_already_active';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.status = 'revoked'
       AND ca.re_request_locked_until IS NOT NULL
       AND ca.re_request_locked_until > now()
  ) THEN
    RAISE EXCEPTION 're_request_locked';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.access_requests ar
     WHERE ar.child_id = p_child_id AND ar.requester_id = v_caller
       AND ar.status = 'denied'
       AND ar.reviewed_at IS NOT NULL
       AND ar.reviewed_at > now() - INTERVAL '30 days'
  ) THEN
    RAISE EXCEPTION 're_request_locked';
  END IF;

  BEGIN
    INSERT INTO public.access_requests (child_id, requester_id, status)
    VALUES (p_child_id, v_caller, 'pending')
    RETURNING id INTO v_req_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'request_already_pending';
  END;

  PERFORM public.log_access_event(
    p_child_id, v_caller, 'request_created', v_caller, 'teen_choice');

  PERFORM public.audit_event(p_child_id, 'access.request_created', 'user',
                             'access_requests', v_req_id::text,
                             jsonb_build_object('requester', v_caller));
  RETURN v_req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_access(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- decide_access_request(p_request_id, p_decision) -> boolean
-- The teen OR an active parent of the child decides a pending request.
--   approved -> marked approved; the grant is created via grant_access(),
--               so D6 caps, co-approval, and lockout all apply (a parent
--               approving a NEW grantee for a 13–15 teen yields
--               pending_coapproval). grant_access() raises on failure,
--               rolling the decision back with it (fail closed).
--   denied   -> status='denied'; the 30-day lockout runs from reviewed_at.
--   blocked  -> status='blocked' (the block-list table itself is a later
--               migration; the request row records the decision).
-- reviewed_by records WHO decided ('child'|'parent').
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_access_request(
  p_request_id uuid,
  p_decision   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := public.safe_auth_uid();
  v_req         public.access_requests%ROWTYPE;
  v_decided_by  text;
  v_event       text;
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'request_required'; END IF;
  IF p_decision IS NULL
     OR p_decision NOT IN ('approved', 'denied', 'blocked') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  SELECT * INTO v_req FROM public.access_requests
   WHERE id = p_request_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = v_req.child_id AND ca.user_id = v_caller
       AND ca.role = 'child' AND ca.status = 'active'
  ) THEN
    v_decided_by := 'child';
  ELSIF EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = v_req.child_id AND ca.user_id = v_caller
       AND ca.role = 'parent' AND ca.status = 'active'
  ) THEN
    v_decided_by := 'parent';
  ELSE
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_event := CASE p_decision
               WHEN 'approved' THEN 'request_approved'
               WHEN 'denied'   THEN 'request_denied'
               ELSE 'block_added'
             END;

  IF p_decision = 'approved' THEN
    IF v_req.requester_id IS NULL THEN
      RAISE EXCEPTION 'legacy_request_no_identity';
    END IF;
    PERFORM public.grant_access(v_req.child_id, v_req.requester_id, 'parent');
  END IF;

  UPDATE public.access_requests
     SET status = p_decision,
         reviewed_by = v_decided_by,
         reviewed_at = now()
   WHERE id = p_request_id;

  PERFORM public.log_access_event(
    v_req.child_id, v_caller, v_event, v_req.requester_id, 'teen_choice');

  PERFORM public.audit_event(v_req.child_id, 'access.request_decided', 'user',
                             'access_requests', p_request_id::text,
                             jsonb_build_object('decision', p_decision,
                                                'decided_by', v_decided_by));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_access_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_access_request(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- expire_stale_access_requests() -> integer
-- Daily cron (service_role only). Pending requests past their 30-day TTL
-- move to status='expired' (ledger-friendly; denied/blocked rows are kept
-- as the decision record). One ledger row per expiry.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_access_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r       public.access_requests%ROWTYPE;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.access_requests
     WHERE status = 'pending'
       AND expires_at <= now()
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.access_requests
       SET status = 'expired'
     WHERE id = r.id;
    PERFORM public.log_access_event(
      r.child_id, NULL, 'request_denied', r.requester_id, 'request_expired',
      '{"expired": true}'::jsonb);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_access_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_access_requests() TO service_role;
