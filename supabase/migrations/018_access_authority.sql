-- Migration 018: child access authority (granted_by / status / revoke matrix)
--
-- CONTEXT: locked spec USER-FIRST-ACCESS-MODEL-SPEC.md §3 — the CHILD is the
-- access authority. A grant made by the child cannot be vetoed or revoked by
-- any parent. Enforcement is server-side in the RPCs below; the client never
-- derives roles.
--
-- MD DECISION D6 (2026-10-12) — tiered time-boxed grant caps, implemented here:
--   * grantee_tier: 'trusted' if the grantee has ANY prior grant history for
--     this child (a child_access row in any status, or a prior 'grant'
--     access_event); otherwise 'new'. ("Family" beyond grant history is not
--     modeled in v1; history is the trust proxy.)
--   * caps enforced in grant_access(): trusted = 8 grants / 30 days,
--     new = 2 grants / 30 days -> 'grant_cap_exceeded'.
--   * teen co-approval (13–15 only): a PARENT granting a NEW grantee creates
--     status='pending_coapproval' instead of 'active'. approve_grant() /
--     decline_grant() are teen-only. Trusted grantees skip co-approval, and
--     so do teen granters (the teen IS the authority).
--
-- CHANGES:
--   1. child_access.granted_by text NOT NULL DEFAULT 'system'
--      CHECK ('child','parent','system'); backfill: existing rows -> 'parent'.
--   2. child_access.granted_by_user_id uuid (WHO granted; NULL only for
--      'system' rows).
--   3. child_access.status text NOT NULL DEFAULT 'active'
--      CHECK ('active','revoked','scheduled_revoke','pending_coapproval').
--   4. child_access.cooling_off_until / re_request_locked_until / revoked_at
--      — bookkeeping for the 13–15 seven-day cooling-off and the 30-day
--      re-request lockout (enforced in revoke_access / request_access).
--   5. child_age_tier(p_child_id): 'under13'|'t13_15'|'t16_17'|'adult'|
--      'unknown' from children.date_of_birth. NULL DOB fails closed
--      ('unknown'); callers treat 'unknown' as the most restrictive tier.
--      NOTE (integration point): the emancipation override
--      (children.legal_status, sol-access §10) is a LATER migration; this
--      function is DOB-only for now.
--   6. RPCs (SECURITY DEFINER, SET search_path=public, fail closed):
--        grant_access(p_child_id, p_user_id, p_role DEFAULT 'parent',
--                     p_expires_at DEFAULT NULL, p_grant_purpose DEFAULT NULL)
--        revoke_access(p_child_id, p_user_id)
--        approve_grant(p_child_id, p_user_id)   -- teen-only co-approval
--        decline_grant(p_child_id, p_user_id)   -- teen-only
--        apply_cooling_off_revocations() — daily cron, service_role only.
--      NOTE: grant_access references the timeboxed columns expires_at /
--      grant_kind / grant_purpose, which are added by 023. Function bodies
--      resolve at execution time, so 023 must be applied before any call.
--   7. Table/column COMMENTs documenting the revoke matrix.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS / named CHECK via pg_constraint guard /
-- CREATE OR REPLACE FUNCTION. Safe to re-run. The backfill UPDATE only touches
-- rows still 'system' (on first apply, that is exactly the pre-existing set).
--
-- GRANT MODEL (015 convention): RLS policies grant nothing new. Only new
-- privilege surface is EXECUTE on the RPCs for authenticated (+ service_role);
-- the two cron/sweep functions are service_role-only.

-- ---------------------------------------------------------------------------
-- Part 1 — columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.child_access
  ADD COLUMN IF NOT EXISTS granted_by text NOT NULL DEFAULT 'system';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'child_access_granted_by_check') THEN
    ALTER TABLE public.child_access
      ADD CONSTRAINT child_access_granted_by_check
      CHECK (granted_by IN ('child', 'parent', 'system'));
  END IF;
END
$$;

ALTER TABLE public.child_access
  ADD COLUMN IF NOT EXISTS granted_by_user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.child_access
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'child_access_status_check') THEN
    ALTER TABLE public.child_access
      ADD CONSTRAINT child_access_status_check
      CHECK (status IN ('active', 'revoked', 'scheduled_revoke',
                        'pending_coapproval'));
  END IF;
END
$$;

-- Revoke-matrix bookkeeping (NULL unless the row went through that path)
ALTER TABLE public.child_access
  ADD COLUMN IF NOT EXISTS cooling_off_until timestamptz;
ALTER TABLE public.child_access
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.child_access
  ADD COLUMN IF NOT EXISTS re_request_locked_until timestamptz;

CREATE INDEX IF NOT EXISTS child_access_status_idx
  ON public.child_access (child_id, status);

-- ---------------------------------------------------------------------------
-- Part 2 — backfill: every pre-existing row was parent-created
-- granted_by_user_id is resolved where the granter is identifiable (the
-- child's creating parent); otherwise it stays NULL with granted_by='parent'
-- per the locked spec's backfill rule.
-- ---------------------------------------------------------------------------
UPDATE public.child_access ca
   SET granted_by = 'parent',
       granted_by_user_id = COALESCE(ca.granted_by_user_id, c.parent_user_id)
  FROM public.children c
 WHERE ca.child_id = c.id
   AND ca.granted_by = 'system'
   AND ca.user_id = c.parent_user_id;

UPDATE public.child_access
   SET granted_by = 'parent'
 WHERE granted_by = 'system';

-- ---------------------------------------------------------------------------
-- Part 3 — revoke-matrix documentation on the table
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.child_access IS
  'Tenant membership — single source of truth for access. REVOKE MATRIX (enforced server-side in revoke_access(), 018): '
  '(A) a grantee may always revoke their own row (self-revoke, leaving is not a veto); '
  '(B) the teen (role=child) may revoke ANY row on their child; '
  '(C) a parent may revoke only rows THEY granted (granted_by=parent AND granted_by_user_id = caller); '
  '(D) a parent may NEVER revoke a child-made grant (granted_by=child) — raises child_grant_untouchable; '
  '(E) a parent may never revoke another parent''s grant — raises not_your_grant; '
  '(F) the teen''s own role=child row is irrevocable (revoking the child''s own access is impossible); '
  '(G) 13–15 teen revoking a parent does NOT revoke immediately: status=scheduled_revoke with a 7-day cooling_off_until (cancellable, notify hook logged in access_events); '
  '16–17 revokes are instant and reversible. '
  'D6 CO-APPROVAL: a parent granting a NEW grantee (no prior grant history) to a 13–15 teen creates status=pending_coapproval; only the teen approves/declines (approve_grant/decline_grant). '
  'D6 CAPS: trusted grantees (prior history) 8 grants/30d, new grantees 2 grants/30d — enforced in grant_access(). '
  'The client never derives roles.';
COMMENT ON COLUMN public.child_access.granted_by IS
  'WHOSE authority created this row: child | parent | system. Drives the revoke matrix. Set by RPCs from the verified caller — never trusted from the client.';
COMMENT ON COLUMN public.child_access.status IS
  'active | revoked | scheduled_revoke (13–15 cooling-off, effect at cooling_off_until) | pending_coapproval (D6: parent granted a new grantee, awaiting teen approval).';
COMMENT ON COLUMN public.child_access.re_request_locked_until IS
  '30-day re-request lockout set by revoke_access (and deny paths). request_access / generate_link_code fail closed while this is in the future. Only the teen may waive it early.';

-- ---------------------------------------------------------------------------
-- Part 4 — child_age_tier()
-- DOB-only tier for now. NULL DOB returns 'unknown' (fail closed); RPCs
-- treat 'unknown' as the most restrictive applicable tier.
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
-- Part 5 — grant_access(p_child_id, p_user_id, p_role, p_expires_at,
--                       p_grant_purpose)
--
-- AUTHORITY (fail closed, in order):
--   1. caller authenticated (safe_auth_uid, 014 convention)
--   2. caller is the teen: active role='child' row on this child AND tier
--      13+ (tier 'unknown'/'under13' -> 'age_verification_required')
--      OR caller holds an active role='parent' row on this child
--   3. p_user_id is not the caller and not the teen (cannot_grant_self)
--   4. p_role = 'parent' only (child-role links go through invite/claim/link flows)
--   5. no live row for (child, p_user_id):
--        active/scheduled_revoke -> 'grant_already_active'
--        pending_coapproval       -> 'grant_already_pending'
--      A 'revoked' row is RE-GRANTED in place (PK is (child_id, user_id)).
--   6. 30-day re-request lockout: a revoked row with
--      re_request_locked_until in the future blocks re-grant UNLESS the
--      caller is the teen (the lock protects the teen; only the teen lifts).
-- D6 — grantee tier + caps:
--   7. v_tier = 'trusted' if ANY prior grant history for (child, grantee)
--      (a child_access row in any status, or a prior 'grant' access_event);
--      else 'new'.
--   8. Cap: trusted 8 / new 2 grants per rolling 30 days (counted from
--      access_events: effective grants only). Exceed -> 'grant_cap_exceeded'.
-- D6 — teen co-approval (13–15 only):
--   9. If the granter is a PARENT, the grantee is NEW, and an active teen
--      row exists with tier t13_15 (or 'unknown', fail closed), the row is
--      created as status='pending_coapproval' (event reason
--      'pending_coapproval', not counted toward caps). The teen completes it
--      via approve_grant()/decline_grant(). Trusted grantees, teen granters,
--      16–17, and parent-managed (no teen row) profiles skip co-approval.
-- granted_by is derived from the CALLER ('child'|'parent'), never from input.
-- p_expires_at sets a timeboxed grant (grant_kind='occasion', columns in 023);
-- otherwise the grant is indefinite. Writes access_events + audit_event.
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

  -- Caller authority
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

  -- Existing row?
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
    -- Revoked row: 30-day re-request lockout (teen may waive by re-granting).
    IF NOT v_is_teen
       AND v_row.re_request_locked_until IS NOT NULL
       AND v_row.re_request_locked_until > now() THEN
      RAISE EXCEPTION 're_request_locked';
    END IF;
    v_regranted := true;
    v_reason := 'regrant';
  END IF;

  -- D6: grantee tier from prior grant history (row in any status, or a prior
  -- 'grant' access_event). A regrant trivially has history -> 'trusted'.
  SELECT CASE WHEN EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = p_child_id AND ca.user_id = p_user_id
    ) OR EXISTS (
      SELECT 1 FROM public.access_events ae
       WHERE ae.child_id = p_child_id AND ae.subject_user_id = p_user_id
         AND ae.event_type = 'grant'
    ) THEN 'trusted' ELSE 'new' END
  INTO v_grantee_tier;

  -- D6: tiered frequency caps on EFFECTIVE grants per rolling 30 days.
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

  -- D6: teen co-approval for NEW grantees, granted by a parent, 13–15 only.
  -- ('unknown' tier fails closed into co-approval; no teen row, 16–17, or
  -- teen granter skips it.)
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
    p_child_id, v_caller, p_user_id, 'grant', v_granted_by, v_reason,
    NULL, NULL);

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
-- Part 6 — revoke_access(p_child_id, p_user_id)
--
-- REVOKE MATRIX (server-side, in order):
--   A. row missing / not live            -> 'access_not_found'
--   B. row.role = 'child'                -> 'child_access_irrevocable'
--      (revoking the teen's own access is impossible by design)
--   C. caller == grantee (self-revoke)   -> ALLOW, instant
--   D. caller is the teen                -> ALLOW on any row
--        * 13–15 revoking a parent: status='scheduled_revoke',
--          cooling_off_until = now()+7d (notify hook: access_events row
--          with reason 'cooling_off_scheduled'; the notify fan-out reads it)
--        * 16+/adult: instant. 'unknown' tier fails closed -> cooling.
--   E. row.granted_by='parent' AND granted_by_user_id = caller -> ALLOW, instant
--   F. row.granted_by='child' AND caller is a parent
--                                         -> 'child_grant_untouchable' (DENY)
--   G. row.granted_by='parent', granter != caller -> 'not_your_grant' (DENY)
--   H. row.granted_by='system'           -> teen-only (DENY otherwise)
--   I. anything else                     -> 'not_authorized' (DENY)
-- A 'pending_coapproval' row cancelled here is DELETED (it never took
-- effect; the ledger row in access_events is the record) — no lockout.
-- Instant revokes set re_request_locked_until = now()+30d (teen may waive).
-- Writes access_events ('revoke') + audit_event.
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

  -- (B) The teen's own row is irrevocable.
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
    -- (C) Self-revoke: always allowed, instant. Leaving is not a veto.
    NULL;
  ELSIF v_is_teen THEN
    -- (D) Teen authority over every row on their own record.
    v_tier := public.child_age_tier(p_child_id);
    IF v_tier IN ('t13_15', 'unknown') THEN
      -- 'unknown' fails closed into the cooling path (most restrictive).
      v_cooling := true;
    END IF;
  ELSIF v_row.granted_by = 'parent' AND v_row.granted_by_user_id = v_caller THEN
    -- (E) Parents revoke only their own grants.
    NULL;
  ELSIF v_row.granted_by = 'child' AND v_is_parent THEN
    -- (F) Child-made grants are parent-untouchable. No veto, no revoke.
    RAISE EXCEPTION 'child_grant_untouchable';
  ELSIF v_row.granted_by = 'parent' THEN
    -- (G) Another parent's grant.
    RAISE EXCEPTION 'not_your_grant';
  ELSIF v_row.granted_by = 'system' THEN
    -- (H) System rows: teen-only (covered above); everyone else denied.
    RAISE EXCEPTION 'not_authorized';
  ELSE
    -- (I) Fail closed.
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Cancelling a not-yet-effective co-approval: delete the provisional row.
  IF v_row.status = 'pending_coapproval' THEN
    DELETE FROM public.child_access
     WHERE child_id = p_child_id AND user_id = p_user_id;
    PERFORM public.log_access_event(
      p_child_id, v_caller, p_user_id, 'revoke', v_row.granted_by,
      'pending_cancelled', NULL, NULL);
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
    -- Notify hook: the notify fan-out watches access_events for
    -- event_type='revoke' AND reason_code='cooling_off_scheduled'.
    PERFORM public.log_access_event(
      p_child_id, v_caller, p_user_id, 'revoke', v_row.granted_by,
      'cooling_off_scheduled', NULL, NULL);
  ELSE
    UPDATE public.child_access
       SET status = 'revoked',
           revoked_at = now(),
           cooling_off_until = NULL,
           re_request_locked_until = now() + INTERVAL '30 days'
     WHERE child_id = p_child_id AND user_id = p_user_id;
    PERFORM public.log_access_event(
      p_child_id, v_caller, p_user_id, 'revoke', v_row.granted_by,
      'teen_choice', NULL, NULL);
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
-- Part 7 — approve_grant(p_child_id, p_user_id) / decline_grant(...)
-- D6 teen co-approval completion. TEEN-ONLY: the caller must hold the active
-- role='child' row on this child; a parent cannot approve their own pending
-- grant (that would defeat the co-approval). approve re-checks the D6 cap.
-- decline DELETES the provisional row (it never took effect; no lockout —
-- the grantee never had access).
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

  -- Re-check the D6 cap at approval time (effective grants only).
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
    p_child_id, v_caller, p_user_id, 'grant', v_row.granted_by,
    'coapproval_granted', NULL, NULL);
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
    p_child_id, v_caller, p_user_id, 'revoke', NULL,
    'coapproval_declined', NULL, NULL);
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
-- Part 8 — apply_cooling_off_revocations()
-- Daily cron (service_role). Rows whose 7-day cooling elapsed become 'revoked'.
-- Notify hook: fan-out reads the 'cooling_off_expired' access_events rows.
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
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. Columns + checks:
--    SELECT column_name FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='child_access'
--       AND column_name IN ('granted_by','granted_by_user_id','status',
--                           'cooling_off_until','revoked_at','re_request_locked_until');
--    -- expect 6 rows
-- 2. Backfill: SELECT granted_by, count(*) FROM public.child_access GROUP BY 1;
--    -- expect all rows 'parent' (pre-existing set)
-- 3. Tier: SELECT public.child_age_tier('<child_id>'); -- matches DOB math
-- 4. Matrix (as fixtures): parent A grants B; parent C calls revoke_access
--    -> ERROR not_your_grant. Teen grants B; parent A calls revoke_access
--    -> ERROR child_grant_untouchable. Teen (13–15) revokes parent A
--    -> status='scheduled_revoke', cooling_off_until ~ +7d.
-- 5. D6 co-approval: parent grants NEW user U to a t13_15 child
--    -> row status='pending_coapproval'; teen approve_grant -> 'active';
--    parent approve_grant -> ERROR not_authorized.
-- 6. D6 caps: force 2 effective grants to a new grantee in 30d; 3rd
--    grant_access -> ERROR grant_cap_exceeded.
-- 7. Cron grants: SELECT grantee FROM information_schema.routine_privileges
--      WHERE routine_schema='public' AND routine_name='apply_cooling_off_revocations';
--    -- expect service_role only
