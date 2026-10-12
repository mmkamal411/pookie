-- Migration 036: safety extensions (Squad 1 Safety Track)
--
-- CONTEXT: FR-SAFETY-011/012 (court orders), FR-SAFETY-013/014/015
-- (break-glass Paths A+B), MD decisions D1 (contracted crisis vendor) + D7
-- (coarse-only location). Numbering: per APPLY_ORDER.md collision directive.
--
-- *** COUNSEL GATE (FR-SAFETY-015 / NFR-LEGAL-006) ***
-- This migration is SCHEMA ONLY for break-glass. No disclosure tooling, no
-- LE portal, no approval UI, no grant-issuance code is built here — those
-- are gated on licensed-counsel sign-off. The emergency_requests table is
-- the append-only record the future (counsel-approved) flow will write to;
-- the vendor integration seam is specified as an interface contract in
-- docs/squad1/api-contracts.md (vendor_crisis_review). Nothing in this
-- file discloses data to anyone.
--
-- CHANGES:
--   1. emergency_requests: append-only Path A (teen-configured safety net,
--      contracted crisis vendor reviews) + Path B (law-enforcement exigent
--      requests, SCA §2702(b)(8)) record. Status lifecycle, corroboration,
--      verification artifacts, 12h/72h expiry columns, decision log.
--      D7: teen_last_known_city/postal_code are coarse TEXT — precise GPS is
--      never held, so break-glass location scope is "coarse location + W19
--      medical card" BY CONSTRUCTION (documented invariant).
--   2. expire_stale_emergency_requests() (service_role): timeout
--      bookkeeping ONLY — marks vendor_timeout / expired. It sends nothing
--      and discloses nothing.
--   3. court_orders + children.court_order_restriction +
--      children.travel_restriction_profile (FR-SAFETY-011/012). Schema only:
--      verified orders supersede via HUMAN review; Pookie does not adjudicate
--      custody (D5: STAY OUT for v1). No auto-enforce.
--
-- IDEMPOTENT: IF NOT EXISTS / constraint guards / CREATE OR REPLACE.
--
-- GRANT MODEL (015 convention): RLS grants nothing new. emergency_requests
-- and court_orders: teen SELECT own (transparency); all writes service_role
-- (future counsel-gated flows). expire_stale_emergency_requests: service_role.

-- ---------------------------------------------------------------------------
-- Part 1 — emergency_requests (append-only; counsel-gated flows)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  path text NOT NULL CHECK (path IN ('teen_safety_net', 'law_enforcement')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      -- Path A lifecycle (contracted vendor reviews corroboration)
      'draft', 'submitted_to_vendor', 'vendor_approved', 'vendor_denied',
      'vendor_timeout', 'grant_active', 'expired', 'closed',
      -- Path B lifecycle (LE exigent, SCA 2702(b)(8))
      'received', 'verifying', 'approved', 'denied', 'disclosed')),
  -- Path A: ONLY the teen's pre-designated trusted adult may trigger.
  -- Hard invariant (FR-SAFETY-013): a revoked adult can never be the
  -- break-glass contact; enforced at the (counsel-gated) issuance layer.
  -- FK to trusted_adults is added in 049_safety_trusted_adult_fks.sql: the
  -- trusted_adults table lands in 048, which sorts after this file.
  requested_by_trusted_adult_id uuid,
  -- Corroboration: two independent confirmations required (Path A).
  corroboration jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- D7 coarse-only invariant: city/ZIP TEXT. Pookie never holds precise GPS,
  -- so there is no precise location to disclose — by architecture, not policy.
  teen_last_known_city text,
  teen_last_known_postal_code text,
  -- Vendor seam (D1): contracted crisis-response vendor, provider TBD.
  -- Interface contract: docs/squad1/api-contracts.md (vendor_crisis_review).
  vendor_request_id text,
  vendor_submitted_at timestamptz,
  vendor_callback_deadline timestamptz,
  vendor_decision text CHECK (vendor_decision IN ('approved', 'denied')),
  vendor_decided_at timestamptz,
  -- 12h auto-expiry (Path A) fires on vendor approval; 72h incident-bounded
  -- cap (Path B, renewable on fresh attestation). Auto-expiry kills access
  -- grants only; records go on litigation hold (7-year retention of the
  -- request/verification/disclosure package — spoliation guard).
  grant_expires_at timestamptz,
  teen_notified_at timestamptz,
  closed_at timestamptz,
  closure_reason text,
  -- Path B verification artifacts: callback to independently-sourced agency
  -- number + written official-channel confirmation within 24h + two-employee
  -- approval. Time pressure never lowers the bar.
  verification_artifacts jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS emergency_requests_status_idx
  ON public.emergency_requests (status, vendor_callback_deadline)
  WHERE status = 'submitted_to_vendor';
CREATE INDEX IF NOT EXISTS emergency_requests_grant_expiry_idx
  ON public.emergency_requests (grant_expires_at)
  WHERE status = 'grant_active';

COMMENT ON TABLE public.emergency_requests IS
  'Append-only break-glass record (FR-SAFETY-013/014/015). COUNSEL-GATED: schema only — no disclosure tooling, LE portal, or approval UI is built until NFR-LEGAL-006 sign-off. Path A: teen-configured safety net, trigger ONLY by the teen''s pre-designated trusted adult, corroboration required, human review by the CONTRACTED crisis vendor (D1), 12h auto-expiry. Path B: law-enforcement exigent (SCA 2702(b)(8)), callback verification, 72h incident-bounded cap. Categorical exclusions: revoked/blocked parents can never trigger, receive, or be notified; "parent cannot locate teen" is NOT an emergency. D7: location scope is coarse city/ZIP + W19 medical card BY CONSTRUCTION — precise GPS is never held. Spoliation guard: 7-year retention of the request/verification/disclosure package.';

ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emergency_requests_teen_read ON public.emergency_requests;
CREATE POLICY emergency_requests_teen_read ON public.emergency_requests
  FOR SELECT TO authenticated
  USING (public.is_teen_of(child_id));

-- ---------------------------------------------------------------------------
-- Part 2 — expire_stale_emergency_requests() (timeout bookkeeping only)
-- Marks vendor_timeout past the callback deadline and expired past the grant
-- expiry. Sends nothing, discloses nothing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_emergency_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.emergency_requests
     SET status = 'vendor_timeout',
         decision_log = decision_log || jsonb_build_object(
           'at', now(), 'actor', 'system', 'decision', 'vendor_timeout',
           'note', 'Callback deadline passed without a vendor decision.')
   WHERE status = 'submitted_to_vendor'
     AND vendor_callback_deadline IS NOT NULL
     AND vendor_callback_deadline <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.emergency_requests
     SET status = 'expired',
         closed_at = now(),
         closure_reason = 'grant_expired',
         decision_log = decision_log || jsonb_build_object(
           'at', now(), 'actor', 'system', 'decision', 'expired',
           'note', 'Auto-expiry fired: access grants ended; records on litigation hold.')
   WHERE status = 'grant_active'
     AND grant_expires_at IS NOT NULL
     AND grant_expires_at <= now();
  GET DIAGNOSTICS v_count = v_count + ROW_COUNT;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_emergency_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_emergency_requests() TO service_role;

-- ---------------------------------------------------------------------------
-- Part 3 — court orders (FR-SAFETY-011/012; schema only, human review)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.court_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  order_type text NOT NULL,
  issuing_court text,
  restrictions jsonb NOT NULL DEFAULT '{}'::jsonb,
  presented_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'verified', 'rejected', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.court_orders IS
  'Court-order ingestion (FR-SAFETY-011/012). Verified orders supersede via HUMAN review; the teen is told plainly why access changed. D5: custody STAY OUT for v1 — Pookie does not adjudicate custody; disputes go to human review case-by-case. No auto-enforce.';

ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS court_order_restriction boolean NOT NULL DEFAULT false;
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS travel_restriction_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.children.court_order_restriction IS
  'FR-SAFETY-011: set only after human verification of a presented court order (court_orders.status=verified). No auto-enforce.';
COMMENT ON COLUMN public.children.travel_restriction_profile IS
  'FR-SAFETY-012: custody-order travel-restriction profile. Human-review only.';

ALTER TABLE public.court_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS court_orders_teen_read ON public.court_orders;
CREATE POLICY court_orders_teen_read ON public.court_orders
  FOR SELECT TO authenticated
  USING (public.is_teen_of(child_id));

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. Inserting a teen_safety_net request with a revoked adult as
--    requested_by is schema-allowed but MUST be rejected at the issuance
--    layer (counsel-gated; invariant documented, not yet executable).
-- 2. expire_stale_emergency_requests flips submitted_to_vendor past
--    deadline -> vendor_timeout (no disclosure).
-- 3. No lat/lng/geography columns on emergency_requests (D7).
-- 4. check.sh passes.
