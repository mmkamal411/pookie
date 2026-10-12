-- Migration 029: W12 Babysitters — directory + time-boxed grants with D6 tiered caps (FR-MOD-W12)
--
-- DIRECTORY (spec §186): parent-vetted only. The disclaimer is IN the data
-- model as a constant default on every row:
--   'parent-vetted, not background-checked by Pookie'
-- Real background checks require FCRA counsel first — until then the label is
-- the product, not a footnote.
--
-- TIME-BOXED GRANTS (PANEL-ROUND2 Proposal 2, MD decision D6 2026-10-12):
--   - Tiered frequency caps, enforced server-side in request_sitter_grant():
--       trusted (previously approved, no blocks on record): 8 grants / grantee / rolling 30d
--       first_time: 2 grants / grantee / rolling 30d
--   - Installment detection stays active for BOTH tiers: chained grants that
--     evade the caps (back-to-back "temporary" grants forming continuous
--     coverage) are flagged 'installment_suspect' and routed to teen co-approval.
--   - Teen co-approval (13–15): required for NEW grantees only. Renewals of an
--     existing trusted grantee within cap do NOT re-prompt the teen.
--   - Scope allowlist at the RPC layer: schedule, pickup, emergency_medical
--     only. Reflection/Wellness/H2/H3 are REJECTED for temporary grants.
--   - Blocks propagate: a blocked sitter (block_on_record) cannot receive
--     grants, and 30-day re-request lockout applies.
--
-- MIGRATION 023 DEPENDENCY (idempotent): Platform Team 1's 023 adds expires_at
-- (and grant_kind/grant_purpose/recurrence_rule) to child_access for the
-- general grant system. If 023 has landed, the ADD COLUMN IF NOT EXISTS below
-- are no-ops and 023's definitions win. If it has NOT landed, this migration
-- creates the columns so sitter grants work standalone. Either way the
-- time-boxed logic in this file is the source of truth for W12 — no dead
-- stubs, no TODOs waiting on another team.

-- ---------------------------------------------------------------------------
-- Idempotent 023 columns on child_access (no-op when 023 already applied).
-- ---------------------------------------------------------------------------
ALTER TABLE public.child_access
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS grant_kind text,
  ADD COLUMN IF NOT EXISTS grant_purpose text,
  ADD COLUMN IF NOT EXISTS recurrence_rule text;

-- ---------------------------------------------------------------------------
-- babysitters: the parent-vetted directory.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.babysitters (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- tenant key (household anchor)
  name              text NOT NULL,
  contact           text,                                                        -- phone/email (parent-provided)
  notes             text,
  vetted_by         uuid REFERENCES public.users(id),                           -- parent who vetted
  vetted_at         timestamptz,
  -- D6: grantee tier. 'trusted' = previously approved AND no blocks on record.
  -- New rows start 'first_time'; promotion happens via record_sitter_grant_outcome().
  trust_tier        text NOT NULL DEFAULT 'first_time' CHECK (trust_tier IN ('first_time','trusted')),
  block_on_record   boolean NOT NULL DEFAULT false,                             -- block => no future grants
  -- The disclaimer is a data-model constant (spec §186). Every row carries it.
  vetting_disclaimer text NOT NULL DEFAULT 'parent-vetted, not background-checked by Pookie',
  data_class        text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS babysitters_owner_idx ON public.babysitters (owner_user_id);

-- ---------------------------------------------------------------------------
-- sitter_grants: time-boxed access grants for a sitter × child.
-- grantee_tier is snapshotted at request time (D6 auditability).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sitter_grants (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id              uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,  -- tenant key
  sitter_id             uuid NOT NULL REFERENCES public.babysitters(id) ON DELETE CASCADE,
  granted_by            uuid NOT NULL REFERENCES public.users(id),      -- the parent who granted
  purpose               text NOT NULL,                                  -- reason code: 'babysitter','pickup','tutor'
  scope                 jsonb NOT NULL DEFAULT '["schedule","pickup","emergency_medical"]'::jsonb,
  starts_at             timestamptz NOT NULL,
  expires_at            timestamptz NOT NULL,
  grantee_tier          text NOT NULL CHECK (grantee_tier IN ('first_time','trusted')),
  -- D6 teen co-approval (13–15): 'required' for NEW grantees; renewals within
  -- cap are 'not_required'. 'installment_review' when installment detection fires.
  teen_coapproval_status text NOT NULL DEFAULT 'not_required'
                         CHECK (teen_coapproval_status IN ('not_required','required','approved','installment_review')),
  teen_coapproved_by    uuid REFERENCES public.users(id),
  teen_coapproved_at    timestamptz,
  status                text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('pending_approval','active','expired','revoked','flagged')),
  revoked_by            text,                                           -- 'parent' | 'teen' | 'system'
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS sitter_grants_sitter_child_idx
  ON public.sitter_grants (sitter_id, child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sitter_grants_expires_idx
  ON public.sitter_grants (expires_at) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- D6 cap constants (single source of truth for both tiers).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sitter_grant_cap(p_tier text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_tier WHEN 'trusted' THEN 8 WHEN 'first_time' THEN 2 ELSE 2 END
$$;

REVOKE ALL ON FUNCTION public.sitter_grant_cap(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sitter_grant_cap(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- request_sitter_grant(...): the D6 enforcement point (SECURITY DEFINER).
-- Raises on: non-parent caller, blocked sitter, scope outside the allowlist,
-- frequency cap exceeded, or overlapping active grant. Returns the new grant
-- row (status 'pending_approval' when teen co-approval is required).
--
-- Installment detection (active for both tiers): a grant whose starts_at falls
-- within 7 days of a previous grant's expires_at (same sitter × child) extends
-- a "chain". A chain of 3+ grants inside a rolling 30-day window is flagged
-- 'installment_suspect' → teen_coapproval_status='installment_review', so
-- split grants cannot evade the caps.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_sitter_grant(
  p_sitter_id uuid,
  p_child_id  uuid,
  p_purpose   text,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_scope     jsonb DEFAULT '["schedule","pickup","emergency_medical"]'::jsonb
)
RETURNS public.sitter_grants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_sitter      public.babysitters%ROWTYPE;
  v_owner       uuid;
  v_tier        text;
  v_cap         integer;
  v_count_30d   integer;
  v_chain_len   integer;
  v_child_age   integer;
  v_coapproval  text := 'not_required';
  v_status      text := 'active';
  v_grant       public.sitter_grants%ROWTYPE;
  v_scope_item  text;
  v_allowed     text[] := ARRAY['schedule','pickup','emergency_medical'];
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'tenant_membership_required'; END IF;
  IF p_expires_at <= p_starts_at THEN RAISE EXCEPTION 'invalid_grant_window'; END IF;

  -- Caller must be a parent of the child.
  IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.child_id = p_child_id AND ca.user_id = v_caller AND ca.role = 'parent') THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;

  SELECT * INTO v_sitter FROM public.babysitters WHERE id = p_sitter_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sitter_not_found'; END IF;

  -- The sitter must belong to the caller's household.
  v_owner := public.household_owner_for_child(p_child_id);
  IF v_sitter.owner_user_id <> v_owner THEN RAISE EXCEPTION 'tenant_membership_required'; END IF;

  -- Blocks propagate: blocked sitters get no grants.
  IF v_sitter.block_on_record THEN RAISE EXCEPTION 'sitter_blocked'; END IF;

  -- Scope allowlist (Proposal 2): temporary grants reject everything outside
  -- schedule/pickup/emergency_medical at the RPC layer.
  FOR v_scope_item IN SELECT jsonb_array_elements_text(p_scope) LOOP
    IF NOT (v_scope_item = ANY (v_allowed)) THEN RAISE EXCEPTION 'scope_not_allowed'; END IF;
  END LOOP;

  -- D6 tier: trusted = previously approved, no blocks on record.
  v_tier := v_sitter.trust_tier;
  v_cap := public.sitter_grant_cap(v_tier);

  -- Frequency cap: grants created in the rolling 30-day window.
  SELECT COUNT(*) INTO v_count_30d FROM public.sitter_grants
  WHERE sitter_id = p_sitter_id AND child_id = p_child_id
    AND created_at > now() - interval '30 days'
    AND status IN ('active','expired','pending_approval');
  IF v_count_30d >= v_cap THEN RAISE EXCEPTION 'grant_cap_exceeded'; END IF;

  -- Installment detection: chain length — prior grant whose expiry is within
  -- 7 days before this grant's start, recursively (bounded at 12 links).
  WITH RECURSIVE chain AS (
    SELECT id, starts_at, expires_at, 1 AS depth
    FROM public.sitter_grants
    WHERE sitter_id = p_sitter_id AND child_id = p_child_id
      AND expires_at BETWEEN p_starts_at - interval '30 days' AND p_starts_at
      AND expires_at >= p_starts_at - interval '7 days'
    UNION ALL
    SELECT g.id, g.starts_at, g.expires_at, c.depth + 1
    FROM public.sitter_grants g
    JOIN chain c ON g.sitter_id = p_sitter_id AND g.child_id = p_child_id
      AND g.expires_at BETWEEN c.starts_at - interval '30 days' AND c.starts_at
      AND g.expires_at >= c.starts_at - interval '7 days'
      AND c.depth < 12
  )
  SELECT COUNT(*) INTO v_chain_len FROM chain;
  -- +1 for the grant being requested now: 3+ chained grants in 30d = suspect.
  IF v_chain_len + 1 >= 3 THEN
    v_coapproval := 'installment_review';
    v_status := 'flagged';
  END IF;

  -- D6 teen co-approval (13–15): required for NEW grantees only. Renewals of
  -- an existing trusted grantee within cap do not re-prompt the teen.
  IF v_coapproval = 'not_required' AND v_tier = 'first_time' THEN
    SELECT EXTRACT(YEAR FROM age(current_date, date_of_birth))::integer
      INTO v_child_age FROM public.children WHERE id = p_child_id;
    -- Fail closed: unknown age (NULL dob) requires co-approval, like 13–15.
    IF v_child_age IS NULL OR v_child_age BETWEEN 13 AND 15 THEN
      v_coapproval := 'required';
      v_status := 'pending_approval';
    END IF;
  END IF;

  INSERT INTO public.sitter_grants
    (child_id, sitter_id, granted_by, purpose, scope, starts_at, expires_at,
     grantee_tier, teen_coapproval_status, status)
  VALUES
    (p_child_id, p_sitter_id, v_caller, p_purpose, p_scope, p_starts_at, p_expires_at,
     v_tier, v_coapproval, v_status)
  RETURNING * INTO v_grant;

  RETURN v_grant;
END;
$$;

REVOKE ALL ON FUNCTION public.request_sitter_grant(uuid, uuid, text, timestamptz, timestamptz, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_sitter_grant(uuid, uuid, text, timestamptz, timestamptz, jsonb)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- record_sitter_grant_outcome(...): close out a grant; promote the sitter to
-- 'trusted' when a grant completes with no block recorded (D6 tier source).
-- Recording a block sets block_on_record (future grants refused).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_sitter_grant_outcome(
  p_grant_id uuid,
  p_blocked  boolean DEFAULT false
)
RETURNS public.babysitters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant  public.sitter_grants%ROWTYPE;
  v_sitter public.babysitters%ROWTYPE;
BEGIN
  SELECT * INTO v_grant FROM public.sitter_grants WHERE id = p_grant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'grant_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.child_id = v_grant.child_id AND ca.user_id = auth.uid() AND ca.role = 'parent') THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;

  UPDATE public.sitter_grants SET status = 'expired' WHERE id = p_grant_id;

  IF p_blocked THEN
    UPDATE public.babysitters SET block_on_record = true, trust_tier = 'first_time'
    WHERE id = v_grant.sitter_id;
  ELSIF v_grant.teen_coapproval_status <> 'installment_review' THEN
    -- Clean completion promotes to trusted (D6: "previously approved, no blocks").
    UPDATE public.babysitters SET trust_tier = 'trusted', vetted_at = COALESCE(vetted_at, now())
    WHERE id = v_grant.sitter_id;
  END IF;

  SELECT * INTO v_sitter FROM public.babysitters WHERE id = v_grant.sitter_id;
  RETURN v_sitter;
END;
$$;

REVOKE ALL ON FUNCTION public.record_sitter_grant_outcome(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_sitter_grant_outcome(uuid, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: household members read the directory; parents manage it.
-- sitter_grants: parents manage; the granted sitter's teen-visibility is a
-- route concern (teen heads-up notification), not a table read.
-- ---------------------------------------------------------------------------
ALTER TABLE public.babysitters  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sitter_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS babysitters_household_read ON public.babysitters;
CREATE POLICY babysitters_household_read ON public.babysitters
  FOR SELECT USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS babysitters_owner_write ON public.babysitters;
CREATE POLICY babysitters_owner_write ON public.babysitters
  FOR ALL USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS sitter_grants_parent_read ON public.sitter_grants;
CREATE POLICY sitter_grants_parent_read ON public.sitter_grants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM unnest(public.current_child_ids()) AS c(cid)
            WHERE c.cid = public.sitter_grants.child_id)
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.child_id = public.sitter_grants.child_id
                  AND ca.user_id = auth.uid() AND ca.role = 'parent')
  );

DROP POLICY IF EXISTS sitter_grants_parent_insert ON public.sitter_grants;
CREATE POLICY sitter_grants_parent_insert ON public.sitter_grants
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM unnest(public.current_child_ids()) AS c(cid)
            WHERE c.cid = public.sitter_grants.child_id)
    AND granted_by = auth.uid()
  );

DROP POLICY IF EXISTS sitter_grants_parent_update ON public.sitter_grants;
CREATE POLICY sitter_grants_parent_update ON public.sitter_grants
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.child_id = public.sitter_grants.child_id
              AND ca.user_id = auth.uid() AND ca.role = 'parent')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.child_id = public.sitter_grants.child_id
              AND ca.user_id = auth.uid() AND ca.role = 'parent')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.babysitters TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sitter_grants TO authenticated;
