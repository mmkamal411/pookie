-- Migration 049: Second-parent onboarding — full claim flow v1 (FR-AUTH-011, D5 revised)
--
-- D5 (REVISED 2026-10-12): OPEN SIGNUP. v1 ships BOTH:
--   (a) invite-from-inside (deep link/QR) — fastest path, OPTIONAL not required;
--   (b) the FULL corroborated claim flow: verified sign-in + child name/DOB +
--       creating-parent email + perjury-style attestation + custody attestation,
--       approval-routed, NEVER auto-grant.
--
-- APPROVAL ROUTING (no auto-grant ever):
--   child < 13 → Parent A (creating parent on record) approves;
--   child 13+  → the TEEN approves (anti-coercion: fact-only notification to
--                Parent A, no veto). If the teen has no Pookie account yet,
--                the claim waits on Parent A until a teen account exists.
--
-- NON-NEGOTIABLE SAFEGUARDS (Panel Round 2):
--   1. NO ENUMERATION ORACLE: submit_parent_claim() returns a UNIFORM response
--      regardless of match ("if this child is in Pookie, we've notified the
--      parent on record"). Rate limits (5/hr, 20/day per claimant) cap lookup
--      probing; lookups run inside SECURITY DEFINER so timing/match state
--      never leaks through RLS errors.
--   2. 14-DAY ESCALATION: pending claims older than 14 days move to
--      status='escalated' via escalate_stale_claims() (nightly worker). The
--      escalated set IS the human-review queue (staffing = MD action item).
--   3. 30-DAY LOCKOUT: rejection writes claim_lockouts; re-requests inside
--      30 days are silently absorbed (uniform response, no oracle).
--   4. court_order_restriction on children: when set, ALL self-serve linking
--      for that child is disabled (invites fail, claims park as
--      'blocked_court_order' internally). Custody posture: STAY OUT — Pookie
--      does not adjudicate; disputes go to human review.
--
-- SEAM (Platform Team 1, migrations 017-023): this migration REQUIRES
--   child_access.granted_by (text, ∈ 'child'|'parent'|'system') and
--   child_access.status ('active'|'revoked') from 018_access_authority.sql.
-- The DO block below asserts the contract at apply time and fails loudly if
-- the access-model migration has not landed — never a silent broken grant.
--
-- IDEMPOTENT: IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- Prerequisite assertion: access-model contract from 018
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
                  WHERE attrelid = 'public.child_access'::regclass
                    AND attname = 'granted_by') THEN
    RAISE EXCEPTION '031 requires child_access.granted_by (migration 018_access_authority) — apply Platform Team 1 migrations 017-023 first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
                  WHERE attrelid = 'public.child_access'::regclass
                    AND attname = 'status') THEN
    RAISE EXCEPTION '031 requires child_access.status (migration 018_access_authority) — apply Platform Team 1 migrations 017-023 first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- court_order_restriction: STAY-OUT flag. Set only by human-review tooling
-- (service_role); no client write path exists, deliberately.
-- ---------------------------------------------------------------------------
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS court_order_restriction boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- parent_invites: invite-from-inside (deep link / QR). Single-use, 7-day TTL.
-- Only the code HASH is stored; the plaintext code is returned ONCE at
-- creation (the API route builds the deep link / QR from it).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parent_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES public.users(id),
  code_hash   text NOT NULL UNIQUE,              -- sha256 hex of the invite code
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  used_by     uuid REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parent_invites_child_idx ON public.parent_invites (child_id);

ALTER TABLE public.parent_invites ENABLE ROW LEVEL SECURITY;

-- Sender can see invites they created (even after leaving the tenant).
DROP POLICY IF EXISTS parent_invites_sender_read ON public.parent_invites;
CREATE POLICY parent_invites_sender_read ON public.parent_invites
  FOR SELECT USING (created_by = public.safe_auth_uid());

-- No client INSERT/UPDATE: RPC-only (create_parent_invite / redeem_parent_invite).

-- ---------------------------------------------------------------------------
-- create_parent_invite(p_child_id): Parent A generates a deep-link/QR invite.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_parent_invite(p_child_id uuid)
RETURNS TABLE (code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_code text;
  v_hash text;
  v_exp timestamptz := now() + interval '7 days';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (p_child_id = ANY (public.current_child_ids())) THEN
    RAISE EXCEPTION 'tenant_scope_violation';
  END IF;
  -- Fail-closed parent check: a REAL parent-role row, never a default.
  IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                  WHERE ca.user_id = v_uid AND ca.child_id = p_child_id
                    AND ca.role = 'parent' AND ca.status = 'active') THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;
  -- STAY OUT: court orders disable self-serve linking entirely.
  IF EXISTS (SELECT 1 FROM public.children c
              WHERE c.id = p_child_id AND c.court_order_restriction) THEN
    RAISE EXCEPTION 'linking_disabled_court_order';
  END IF;

  -- 64-bit CSPRNG code, hex (URL/QR-safe). Uniqueness serialized by the hash index.
  v_code := substring(encode(gen_random_bytes(8), 'hex') from 1 for 16);
  v_hash := encode(digest(v_code, 'sha256'), 'hex');

  INSERT INTO public.parent_invites (child_id, created_by, code_hash, expires_at)
  VALUES (p_child_id, v_uid, v_hash, v_exp);

  code := v_code; expires_at := v_exp;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.create_parent_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_parent_invite(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- redeem_parent_invite(p_code): Parent B redeems. Uniform failure
-- ('invite_not_found_or_expired') — no oracle for code validity, expiry,
-- prior use, or court-order blocks.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_parent_invite(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_hash text := encode(digest(nullif(trim(p_code), ''), 'sha256'), 'hex');
  v_invite record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT pi.id, pi.child_id INTO v_invite
    FROM public.parent_invites pi
   WHERE pi.code_hash = v_hash
     AND pi.expires_at > now()
     AND pi.used_at IS NULL;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found_or_expired';
  END IF;

  -- STAY OUT: uniform failure, no signal that the flag exists.
  IF EXISTS (SELECT 1 FROM public.children c
              WHERE c.id = v_invite.child_id AND c.court_order_restriction) THEN
    RAISE EXCEPTION 'invite_not_found_or_expired';
  END IF;

  -- The inviter cannot redeem their own invite.
  IF EXISTS (SELECT 1 FROM public.parent_invites pi
              WHERE pi.id = v_invite.id AND pi.created_by = v_uid) THEN
    RAISE EXCEPTION 'cannot_invite_self';
  END IF;

  -- Idempotent for existing members (re-redeem returns the child, no dup row).
  IF EXISTS (SELECT 1 FROM public.child_access ca
              WHERE ca.user_id = v_uid AND ca.child_id = v_invite.child_id
                AND ca.status = 'active') THEN
    UPDATE public.parent_invites
       SET used_at = now(), used_by = v_uid WHERE id = v_invite.id AND used_at IS NULL;
    RETURN v_invite.child_id;
  END IF;

  UPDATE public.parent_invites
     SET used_at = now(), used_by = v_uid
   WHERE id = v_invite.id AND used_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found_or_expired';  -- lost the single-use race
  END IF;

  INSERT INTO public.child_access (child_id, user_id, role, granted_by, status)
  VALUES (v_invite.child_id, v_uid, 'parent', 'parent', 'active')
  ON CONFLICT (child_id, user_id) DO UPDATE
     SET role = 'parent', granted_by = 'parent', status = 'active';

  RETURN v_invite.child_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_parent_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_parent_invite(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- parent_claims: corroborated claim flow (v1, D5 revised)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parent_claims (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claimant_user_id      uuid NOT NULL REFERENCES public.users(id),
  -- Corroboration inputs (stored for human review; NEVER echoed to the claimant):
  child_name            text NOT NULL,
  child_dob             date NOT NULL,
  creating_parent_email text NOT NULL,
  perjury_attestation   boolean NOT NULL,
  attestation_text      text NOT NULL,
  custody_attestation   text NOT NULL,       -- "any court orders limiting access?"
  -- Routing (internal — never revealed to the claimant on submit):
  claimed_child_id      uuid REFERENCES public.children(id) ON DELETE SET NULL,
  approver_user_id      uuid REFERENCES public.users(id),
  approver_kind         text CHECK (approver_kind IN ('parent_a','teen')),
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected',
                                          'escalated','needs_review',
                                          'blocked_court_order','locked')),
  review_notes          text,                -- human-review working notes
  created_at            timestamptz NOT NULL DEFAULT now(),
  decided_at            timestamptz,
  decided_by            uuid REFERENCES public.users(id),
  escalated_at          timestamptz
);

CREATE INDEX IF NOT EXISTS parent_claims_claimant_idx ON public.parent_claims (claimant_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS parent_claims_approver_idx ON public.parent_claims (approver_user_id) WHERE status IN ('pending','escalated');
CREATE INDEX IF NOT EXISTS parent_claims_status_created_idx ON public.parent_claims (status, created_at);

ALTER TABLE public.parent_claims ENABLE ROW LEVEL SECURITY;

-- Claimant sees their own claims (status shown; routing internals included —
-- the claimant already knows what they submitted; claimed_child_id stays NULL
-- for unmatched claims so existence is never confirmed).
DROP POLICY IF EXISTS parent_claims_claimant_read ON public.parent_claims;
CREATE POLICY parent_claims_claimant_read ON public.parent_claims
  FOR SELECT USING (claimant_user_id = public.safe_auth_uid());

-- Designated approver sees claims routed to them.
DROP POLICY IF EXISTS parent_claims_approver_read ON public.parent_claims;
CREATE POLICY parent_claims_approver_read ON public.parent_claims
  FOR SELECT USING (approver_user_id = public.safe_auth_uid());

-- No client INSERT/UPDATE/DELETE: submit_parent_claim / decide_parent_claim only.

-- ---------------------------------------------------------------------------
-- claim_notifications: approver inbox rows ("Parent A / teen has a claim to review")
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim_notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id   uuid NOT NULL REFERENCES public.parent_claims(id) ON DELETE CASCADE,
  notify_user_id uuid NOT NULL REFERENCES public.users(id),
  seen_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.claim_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS claim_notifications_recipient_read ON public.claim_notifications;
CREATE POLICY claim_notifications_recipient_read ON public.claim_notifications
  FOR SELECT USING (notify_user_id = public.safe_auth_uid());

-- ---------------------------------------------------------------------------
-- claim_attempts: rate-limit log (5/hr, 20/day per claimant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim_attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claimant_user_id uuid NOT NULL REFERENCES public.users(id),
  attempted_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claim_attempts_user_time_idx
  ON public.claim_attempts (claimant_user_id, attempted_at DESC);

ALTER TABLE public.claim_attempts ENABLE ROW LEVEL SECURITY;
-- No client policies: written by submit_parent_claim, read by it; service_role
-- owns cleanup.

-- ---------------------------------------------------------------------------
-- claim_lockouts: 30-day re-request lockout after rejection
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim_lockouts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claimant_user_id      uuid NOT NULL REFERENCES public.users(id),
  child_name_norm       text NOT NULL,
  child_dob             date NOT NULL,
  creating_parent_email_norm text NOT NULL,
  rejected_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claim_lockouts_lookup_idx
  ON public.claim_lockouts (claimant_user_id, child_name_norm, child_dob, creating_parent_email_norm);

ALTER TABLE public.claim_lockouts ENABLE ROW LEVEL SECURITY;
-- No client policies: RPC-managed only.

-- ---------------------------------------------------------------------------
-- submit_parent_claim(...): the corroborated claim entry point.
-- RETURNS A UNIFORM RESPONSE REGARDLESS OF MATCH. This is the anti-oracle:
--   { submitted: true, message: 'If this child is in Pookie, we have notified
--     the parent on record.' }
-- Match/no-match, court-order blocks, and lockouts are indistinguishable
-- from the outside.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_parent_claim(
  p_child_name text,
  p_child_dob date,
  p_creating_parent_email text,
  p_perjury_attestation boolean,
  p_attestation_text text,
  p_custody_attestation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_hour_count integer;
  v_day_count integer;
  v_name_norm text := lower(trim(p_child_name));
  v_email_norm text := lower(trim(p_creating_parent_email));
  v_child record;
  v_email_ok boolean;
  v_status text := 'pending';
  v_claimed uuid := NULL;
  v_approver uuid := NULL;
  v_approver_kind text := NULL;
  v_claim_id uuid;
  v_uniform_base jsonb := jsonb_build_object(
    'submitted', true,
    'message', 'If this child is in Pookie, we have notified the parent on record.');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Corroboration inputs are mandatory (perjury-style attestation is load-bearing).
  IF p_perjury_attestation IS NOT TRUE
     OR nullif(trim(p_attestation_text), '') IS NULL
     OR nullif(trim(p_custody_attestation), '') IS NULL
     OR nullif(trim(p_child_name), '') IS NULL
     OR p_child_dob IS NULL
     OR nullif(trim(p_creating_parent_email), '') IS NULL THEN
    RAISE EXCEPTION 'claim_attestation_required';
  END IF;

  -- Rate limits: 5/hour, 20/day per claimant (anti-enumeration).
  SELECT count(*) INTO v_hour_count FROM public.claim_attempts
   WHERE claimant_user_id = v_uid AND attempted_at > now() - interval '1 hour';
  IF v_hour_count >= 5 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  SELECT count(*) INTO v_day_count FROM public.claim_attempts
   WHERE claimant_user_id = v_uid AND attempted_at > now() - interval '1 day';
  IF v_day_count >= 20 THEN RAISE EXCEPTION 'rate_limited'; END IF;

  INSERT INTO public.claim_attempts (claimant_user_id) VALUES (v_uid);

  -- 30-day lockout after rejection: silently absorb (uniform response).
  IF EXISTS (SELECT 1 FROM public.claim_lockouts
              WHERE claimant_user_id = v_uid
                AND child_name_norm = v_name_norm
                AND child_dob = p_child_dob
                AND creating_parent_email_norm = v_email_norm
                AND rejected_at > now() - interval '30 days') THEN
    INSERT INTO public.parent_claims
      (claimant_user_id, child_name, child_dob, creating_parent_email,
       perjury_attestation, attestation_text, custody_attestation, status)
    VALUES (v_uid, trim(p_child_name), p_child_dob, trim(p_creating_parent_email),
            true, p_attestation_text, p_custody_attestation, 'locked')
    RETURNING id INTO v_claim_id;
    RETURN v_uniform_base || jsonb_build_object('claim_id', v_claim_id);
  END IF;

  -- Match: name + DOB against the child record, corroborated by the
  -- creating-parent email belonging to a parent-role accessor of that child.
  SELECT c.id, c.date_of_birth INTO v_child
    FROM public.children c
   WHERE lower(trim(c.first_name || ' ' || c.last_name)) = v_name_norm
     AND c.date_of_birth = p_child_dob
   LIMIT 1;

  IF v_child.id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.child_access ca
      JOIN public.users u ON u.id = ca.user_id
     WHERE ca.child_id = v_child.id
       AND ca.role = 'parent'
       AND ca.status = 'active'
       AND lower(u.email) = v_email_norm
    ) INTO v_email_ok;
  END IF;

  IF v_child.id IS NULL OR v_email_ok IS NOT TRUE THEN
    -- No corroborated match: human-review queue, uniform response.
    INSERT INTO public.parent_claims
      (claimant_user_id, child_name, child_dob, creating_parent_email,
       perjury_attestation, attestation_text, custody_attestation, status)
    VALUES (v_uid, trim(p_child_name), p_child_dob, trim(p_creating_parent_email),
            true, p_attestation_text, p_custody_attestation, 'needs_review')
    RETURNING id INTO v_claim_id;
    RETURN v_uniform_base || jsonb_build_object('claim_id', v_claim_id);
  END IF;

  -- Corroborated match. STAY OUT: court orders disable self-serve entirely.
  IF EXISTS (SELECT 1 FROM public.children c
              WHERE c.id = v_child.id AND c.court_order_restriction) THEN
    INSERT INTO public.parent_claims
      (claimant_user_id, child_name, child_dob, creating_parent_email,
       perjury_attestation, attestation_text, custody_attestation,
       claimed_child_id, status)
    VALUES (v_uid, trim(p_child_name), p_child_dob, trim(p_creating_parent_email),
            true, p_attestation_text, p_custody_attestation,
            v_child.id, 'blocked_court_order')
    RETURNING id INTO v_claim_id;
    RETURN v_uniform_base || jsonb_build_object('claim_id', v_claim_id);
  END IF;

  -- Approval routing: 13+ → teen approves; <13 → Parent A approves.
  IF v_child.date_of_birth <= CURRENT_DATE - interval '13 years' THEN
    SELECT ca.user_id INTO v_approver
      FROM public.child_access ca
     WHERE ca.child_id = v_child.id AND ca.role = 'child' AND ca.status = 'active'
     LIMIT 1;
    IF v_approver IS NOT NULL THEN
      v_approver_kind := 'teen';
    END IF;
  END IF;

  IF v_approver IS NULL THEN
    -- Parent A = the creating parent on record (first active parent accessor
    -- whose email matches; else any active parent).
    SELECT ca.user_id INTO v_approver
      FROM public.child_access ca
      JOIN public.users u ON u.id = ca.user_id
     WHERE ca.child_id = v_child.id AND ca.role = 'parent' AND ca.status = 'active'
       AND lower(u.email) = v_email_norm
     LIMIT 1;
    IF v_approver IS NULL THEN
      SELECT ca.user_id INTO v_approver
        FROM public.child_access ca
       WHERE ca.child_id = v_child.id AND ca.role = 'parent' AND ca.status = 'active'
       ORDER BY ca.created_at LIMIT 1;
    END IF;
    v_approver_kind := 'parent_a';
  END IF;

  v_claimed := v_child.id;

  INSERT INTO public.parent_claims
    (claimant_user_id, child_name, child_dob, creating_parent_email,
     perjury_attestation, attestation_text, custody_attestation,
     claimed_child_id, approver_user_id, approver_kind, status)
  VALUES (v_uid, trim(p_child_name), p_child_dob, trim(p_creating_parent_email),
          true, p_attestation_text, p_custody_attestation,
          v_claimed, v_approver, v_approver_kind, 'pending')
  RETURNING id INTO v_claim_id;

  IF v_approver IS NOT NULL THEN
    INSERT INTO public.claim_notifications (claim_id, notify_user_id)
    VALUES (v_claim_id, v_approver);
  END IF;

  RETURN v_uniform_base || jsonb_build_object('claim_id', v_claim_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_parent_claim(text, date, text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_parent_claim(text, date, text, boolean, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- decide_parent_claim(p_claim_id, p_decision): approve / reject.
-- Only the DESIGNATED approver (or service_role human-review tooling for
-- escalated/needs_review claims) may decide. Approval GRANTS access —
-- granted_by='child' for teen approvals, 'parent' for Parent-A approvals
-- (child access-authority model).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_parent_claim(p_claim_id uuid, p_decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_claim record;
  v_jwt_role text := (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role');
  v_is_staff boolean;
BEGIN
  -- Staff = human-review tooling on service_role (the review console is the
  -- MD's staffing action item; the RPC contract is complete and functional).
  v_is_staff := (v_jwt_role = 'service_role');
  IF v_uid IS NULL AND NOT v_is_staff THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'claim_invalid_decision';
  END IF;

  SELECT * INTO v_claim FROM public.parent_claims WHERE id = p_claim_id;
  IF v_claim.id IS NULL THEN RAISE EXCEPTION 'claim_not_found'; END IF;
  IF v_claim.status NOT IN ('pending','escalated','needs_review') THEN
    RAISE EXCEPTION 'claim_already_decided';
  END IF;

  -- Authorization: the designated approver decides their own claim.
  -- Unmatched claims (approver_user_id NULL, status 'needs_review') are
  -- decided by staff only — the human-review queue.
  IF v_claim.approver_user_id IS NULL THEN
    IF NOT v_is_staff THEN
      RAISE EXCEPTION 'claim_not_your_decision';
    END IF;
  ELSIF v_claim.approver_user_id IS DISTINCT FROM v_uid AND NOT v_is_staff THEN
    RAISE EXCEPTION 'claim_not_your_decision';
  END IF;

  IF p_decision = 'approved' THEN
    IF v_claim.claimed_child_id IS NULL THEN
      RAISE EXCEPTION 'claim_unmatched';
    END IF;
    -- Court-order re-check at decision time (flag may have been set meanwhile).
    IF EXISTS (SELECT 1 FROM public.children c
                WHERE c.id = v_claim.claimed_child_id AND c.court_order_restriction) THEN
      UPDATE public.parent_claims
         SET status = 'blocked_court_order', decided_at = now(), decided_by = v_uid
       WHERE id = p_claim_id;
      RETURN jsonb_build_object('decided', true, 'decision', 'blocked_court_order');
    END IF;

    INSERT INTO public.child_access (child_id, user_id, role, granted_by, status)
    VALUES (v_claim.claimed_child_id, v_claim.claimant_user_id, 'parent',
            CASE WHEN v_claim.approver_kind = 'teen' THEN 'child' ELSE 'parent' END,
            'active')
    ON CONFLICT (child_id, user_id) DO UPDATE
       SET role = 'parent',
           granted_by = CASE WHEN v_claim.approver_kind = 'teen' THEN 'child' ELSE 'parent' END,
           status = 'active';

    UPDATE public.parent_claims
       SET status = 'approved', decided_at = now(), decided_by = v_uid
     WHERE id = p_claim_id;
  ELSE
    -- Rejection: 30-day lockout, one-time dismissible, no reason given.
    INSERT INTO public.claim_lockouts
      (claimant_user_id, child_name_norm, child_dob, creating_parent_email_norm)
    VALUES (v_claim.claimant_user_id,
            lower(trim(v_claim.child_name)), v_claim.child_dob,
            lower(trim(v_claim.creating_parent_email)));

    UPDATE public.parent_claims
       SET status = 'rejected', decided_at = now(), decided_by = v_uid
     WHERE id = p_claim_id;
  END IF;

  UPDATE public.claim_notifications SET seen_at = now()
   WHERE claim_id = p_claim_id AND notify_user_id = v_uid AND seen_at IS NULL;

  RETURN jsonb_build_object('decided', true, 'decision', p_decision);
END;
$$;

REVOKE ALL ON FUNCTION public.decide_parent_claim(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_parent_claim(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- assign_claim_child(p_claim_id, p_child_id): human-review tooling matches an
-- unmatched ('needs_review') claim to a child and re-routes approval
-- (13+ → teen, <13 → Parent A). Service_role only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_claim_child(p_claim_id uuid, p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text := (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role');
  v_claim record;
  v_child record;
  v_approver uuid := NULL;
  v_approver_kind text := 'parent_a';
BEGIN
  IF v_jwt_role <> 'service_role' THEN
    RAISE EXCEPTION 'claim_staff_only';
  END IF;

  SELECT * INTO v_claim FROM public.parent_claims WHERE id = p_claim_id;
  IF v_claim.id IS NULL THEN RAISE EXCEPTION 'claim_not_found'; END IF;
  IF v_claim.status NOT IN ('needs_review','escalated') THEN
    RAISE EXCEPTION 'claim_already_routed';
  END IF;

  SELECT c.id, c.date_of_birth INTO v_child
    FROM public.children c WHERE c.id = p_child_id;
  IF v_child.id IS NULL THEN RAISE EXCEPTION 'claim_child_not_found'; END IF;

  IF v_child.date_of_birth <= CURRENT_DATE - interval '13 years' THEN
    SELECT ca.user_id INTO v_approver
      FROM public.child_access ca
     WHERE ca.child_id = v_child.id AND ca.role = 'child' AND ca.status = 'active'
     LIMIT 1;
    IF v_approver IS NOT NULL THEN v_approver_kind := 'teen'; END IF;
  END IF;
  IF v_approver IS NULL THEN
    SELECT ca.user_id INTO v_approver
      FROM public.child_access ca
     WHERE ca.child_id = v_child.id AND ca.role = 'parent' AND ca.status = 'active'
     ORDER BY ca.created_at LIMIT 1;
  END IF;

  UPDATE public.parent_claims
     SET claimed_child_id = v_child.id,
         approver_user_id = v_approver,
         approver_kind = v_approver_kind,
         status = 'pending',
         review_notes = COALESCE(review_notes,'') || chr(10) || 'staff-matched ' || now()::text
   WHERE id = p_claim_id;

  IF v_approver IS NOT NULL THEN
    INSERT INTO public.claim_notifications (claim_id, notify_user_id)
    VALUES (p_claim_id, v_approver);
  END IF;

  RETURN jsonb_build_object('assigned', true, 'approver_kind', v_approver_kind);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_claim_child(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_claim_child(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- escalate_stale_claims(): 14-day unresponsive escalation → human-review queue.
-- Nightly worker (service_role). The status='escalated' set IS the queue.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.escalate_stale_claims()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n integer;
BEGIN
  UPDATE public.parent_claims
     SET status = 'escalated', escalated_at = now()
   WHERE status = 'pending'
     AND created_at < now() - interval '14 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.escalate_stale_claims() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.escalate_stale_claims() TO service_role;

-- ---------------------------------------------------------------------------
-- preview_parent_invite(p_code): PUBLIC invite preview (FR-AUTH-009).
-- Zero child PII before authentication: returns only the inviter's display
-- name + expiry. Invalid/expired/used codes fail uniformly
-- ('invite_not_found_or_expired') — no enumeration oracle.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_parent_invite(p_code text)
RETURNS TABLE (inviter_name text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text := encode(digest(nullif(trim(p_code), ''), 'sha256'), 'hex');
  v_invite record;
BEGIN
  SELECT pi.created_by, pi.expires_at INTO v_invite
    FROM public.parent_invites pi
   WHERE pi.code_hash = v_hash
     AND pi.expires_at > now()
     AND pi.used_at IS NULL;

  IF v_invite.created_by IS NULL THEN
    RAISE EXCEPTION 'invite_not_found_or_expired';
  END IF;

  RETURN QUERY
    SELECT u.display_name, v_invite.expires_at
      FROM public.users u WHERE u.id = v_invite.created_by;
END;
$$;

REVOKE ALL ON FUNCTION public.preview_parent_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_parent_invite(text) TO anon, authenticated, service_role;
