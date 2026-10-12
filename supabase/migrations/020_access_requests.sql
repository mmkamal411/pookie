-- Migration 020: access requests (user-id-keyed, 30-day re-request rule)
--
-- CONTEXT: spec §3 — any adult may REQUEST access; the teen (and, for young
-- teens, a parent co-approver in a later amendment) decides. Migration 001
-- created access_requests email-keyed for the invite-request flow; this
-- migration extends it to the user-id-keyed "request access" flow while
-- keeping every legacy column and policy arm intact.
--
-- CHANGES:
--   1. New columns: requester_id (auth.users), relationship_claim, message,
--      reviewed_by CHECK ('child','parent'), reviewed_at, expires_at
--      (30-day request TTL).
--   2. status CHECK extended: 'pending','approved','denied','blocked'
--      ('expired' rows are swept; legacy 'pending' rows keep working).
--   3. Partial unique index: one live request per (child, requester_id).
--   4. SELECT policy gains a requester_id = auth.uid() arm.
--   5. RPC request_access(p_child_id) — creates the pending request.
--      THE 30-DAY RE-REQUEST RULE IS ENFORCED HERE (not just app-side):
--        * revoked child_access row with re_request_locked_until in the
--          future -> 're_request_locked'
--        * denied request reviewed within 30 days -> 're_request_locked'
--      Only the teen may waive the lock early (Sharing screen, later work).
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS / constraint drop+re-add guarded by
-- name / CREATE INDEX IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR
-- REPLACE. The status-constraint rewrite is safe to re-run.
-- GRANT MODEL: no new table grants (001 already grants SELECT/INSERT/UPDATE
-- on access_requests to authenticated). Only new surface: EXECUTE on
-- request_access for authenticated + service_role.

-- ---------------------------------------------------------------------------
-- Part 1 — columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS requester_id uuid REFERENCES auth.users(id);
ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS relationship_claim text;
ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT now() + INTERVAL '30 days';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'access_requests_reviewed_by_check') THEN
    ALTER TABLE public.access_requests
      ADD CONSTRAINT access_requests_reviewed_by_check
      CHECK (reviewed_by IN ('child', 'parent'));
  END IF;
END
$$;

-- Extend the 001 status check to the full lifecycle. Drop-by-name + re-add is
-- idempotent: re-running drops the constraint we added and re-adds it.
ALTER TABLE public.access_requests
  DROP CONSTRAINT IF EXISTS access_requests_status_check;
ALTER TABLE public.access_requests
  ADD CONSTRAINT access_requests_status_check
  CHECK (status IN ('pending', 'approved', 'denied', 'blocked'));

COMMENT ON COLUMN public.access_requests.requester_id IS
  'The logged-in requester (user-id-keyed flow). Legacy rows use requester_email only.';
COMMENT ON COLUMN public.access_requests.expires_at IS
  'Request TTL: 30 days. expire_stale_access_requests() (service_role cron, Part 5) removes stale pendings.';

-- One live request per requester per child (server-side duplicate guard).
CREATE UNIQUE INDEX IF NOT EXISTS access_requests_one_pending_per_requester
  ON public.access_requests (child_id, requester_id)
  WHERE status = 'pending' AND requester_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS access_requests_requester_idx
  ON public.access_requests (requester_id);

-- ---------------------------------------------------------------------------
-- Part 2 — RLS: add the requester_id read arm (legacy email arms untouched)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS access_requests_read ON public.access_requests;
CREATE POLICY access_requests_read ON public.access_requests
  FOR SELECT USING (
    requester_id = auth.uid()
    OR lower(requester_email) = lower((SELECT u.email FROM public.users u WHERE u.id = auth.uid()))
    OR (child_id = ANY (public.current_child_ids())
        AND EXISTS (SELECT 1 FROM public.child_access ca
                    WHERE ca.user_id = auth.uid()
                      AND ca.child_id = public.access_requests.child_id
                      AND ca.role = 'parent'))
  );
-- Legacy requester-INSERT and parent-UPDATE policies (001) are unchanged.

-- ---------------------------------------------------------------------------
-- Part 3 — request_access(p_child_id)
--
-- Creates a pending access request for the CALLER. Fail closed:
--   1. caller authenticated
--   2. caller is not the teen of this child (cannot_request_own)
--   3. caller holds no live access row (access_already_active)
--   4. 30-DAY RE-REQUEST LOCKOUT (server-side):
--        a. revoked child_access row with re_request_locked_until > now()
--        b. denied request with reviewed_at within the last 30 days
--      -> 're_request_locked' (the teen alone may waive it early)
--   5. duplicate pending request -> 'request_already_pending'
-- Writes access_events ('request') + audit_event. Returns the request id.
-- The decision RPC (decide_access_request) is Part 4 of this migration.
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

  -- Cannot request access to your own record.
  IF EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.role = 'child'
  ) THEN
    RAISE EXCEPTION 'cannot_request_own';
  END IF;

  -- Already in.
  IF EXISTS (
    SELECT 1 FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
       AND ca.status IN ('active', 'scheduled_revoke')
  ) THEN
    RAISE EXCEPTION 'access_already_active';
  END IF;

  -- 30-day re-request lockout, enforced HERE (not just app-side).
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
    p_child_id, v_caller, v_caller, 'request', NULL,
    'access_requested', NULL, NULL);

  PERFORM public.audit_event(p_child_id, 'access.request_created', 'user',
                             'access_requests', v_req_id::text,
                             jsonb_build_object('requester', v_caller));
  RETURN v_req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_access(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 4 — decide_access_request(p_request_id, p_decision)
--
-- The teen OR an active parent of the child decides a pending request.
-- p_decision: 'approved' | 'denied' | 'blocked'.
--   approved -> the request is marked approved and the grant is created via
--               grant_access() (018), so D6 caps, co-approval, and the
--               30-day lockout all apply. A parent approving a NEW grantee
--               for a 13–15 teen yields status='pending_coapproval'.
--   denied   -> status='denied'; the 30-day re-request lockout runs from
--               reviewed_at (enforced in request_access, Part 3).
--   blocked  -> status='blocked' (the block-list table itself is 025).
-- reviewed_by records WHO decided ('child'|'parent'). Fail closed throughout.
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

  -- Authority: the teen, or an active parent of THIS child.
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

  IF p_decision = 'approved' THEN
    IF v_req.requester_id IS NULL THEN
      -- Legacy email-keyed rows predate the user-id flow; they cannot be
      -- approved into a grant (no login identity to grant to).
      RAISE EXCEPTION 'legacy_request_no_identity';
    END IF;
    -- grant_access() enforces authority, D6 caps/co-approval, and lockout.
    -- It raises on failure, rolling this decision back with it (fail closed).
    PERFORM public.grant_access(v_req.child_id, v_req.requester_id, 'parent');
  END IF;

  UPDATE public.access_requests
     SET status = p_decision,
         reviewed_by = v_decided_by,
         reviewed_at = now()
   WHERE id = p_request_id;

  PERFORM public.log_access_event(
    v_req.child_id, v_caller, v_req.requester_id,
    CASE WHEN p_decision = 'blocked' THEN 'block' ELSE 'request' END,
    NULL,
    'request_' || p_decision,
    NULL, NULL);

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
-- Part 5 — expire_stale_access_requests()
-- Daily cron (service_role). Stale pending requests (expires_at passed) are
-- DELETED — they are noise, not ledger: each expiry is written to
-- access_events first. Denied/blocked rows are kept as the decision record.
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
    PERFORM public.log_access_event(
      r.child_id, NULL, r.requester_id, 'request', NULL,
      'request_expired', NULL, NULL);
    DELETE FROM public.access_requests WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_access_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_access_requests() TO service_role;

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. Columns: SELECT column_name FROM information_schema.columns
--      WHERE table_schema='public' AND table_name='access_requests'
--        AND column_name IN ('requester_id','reviewed_by','reviewed_at','expires_at');
--    -- expect 4 rows
-- 2. Status check: INSERT INTO access_requests (child_id, requester_email, status)
--      VALUES ('<child>','x@y.z','blocked'); -- succeeds
--    ... status='weird' -> CHECK violation.
-- 3. Lockout: revoke a grantee (revoke_access), then as that user
--    SELECT public.request_access('<child>'); -- ERROR re_request_locked
-- 4. Happy path: as a stranger, SELECT public.request_access('<child>');
--    -- returns uuid; second call -> ERROR request_already_pending
-- 5. Legacy rows: pre-existing email-keyed rows still SELECT under the old arms.
-- 6. Decide: teen calls decide_access_request(id,'approved') -> grant row
--    created (or pending_coapproval under D6); 'denied' -> 30-day lockout
--    from reviewed_at; second decide -> ERROR request_not_pending.
-- 7. Sweeper: expire_stale_access_requests() deletes expired pendings
--    (service_role only) after logging each expiry.
