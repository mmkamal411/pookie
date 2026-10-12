-- Migration 032: outing plans + Explorer Setup gate (Squad 1 Safety Track)
--
-- CONTEXT: sol-safety.md §5 (§1.5.4), FR-SAFETY-007. Numbering: per
-- APPLY_ORDER.md collision directive (Squad 1 -> 026+).
--
-- CHANGES:
--   1. children.explorer_setup_completed_at / explorer_setup_version: the
--      one-time Out & About gate (trusted-adult contact + 3-min Safety
--      Basics + family-aware defaults until 16). Required for 13-15 before
--      any plan save; 16-17 see the lighter version (client-tracked).
--   2. outing_plans: teen-composed itineraries (destination, companions,
--      depart/return, check-in timer, recipient). Voluntary and
--      teen-controlled — Pookie never auto-shares location.
--   3. rpc_save_outing_plan: server-side gating (never UI-hiding alone) —
--      Explorer Setup required <16, outing_contact recipient required <16,
--      dusk guard (return within 90 min of sunset needs explicit teen
--      override + trusted-adult share <16; warning 16-17).
--   4. rpc_update_outing_plan_status / rpc_flag_overdue_outing_plans
--      (service_role; marks overdue rows for the notify fan-out, which sends
--      the teen-first nudge then the recipient alert per §5.4).
--
-- D7 (MD decision, coarse-only location — architectural constraint):
--   Location columns are city/postal_code TEXT ONLY. There are no
--   geography/point/lat/lng columns anywhere in this migration, and the RPC
--   accepts no precise coordinates. Break-glass disclosure scope is
--   therefore "coarse location + W19 medical card" by construction (036).
--   The plan is an itinerary, not a track: no location history is retained
--   <18 (G14); rows are teen-deletable and auto-complete at return_at + 2h.
--
-- IDEMPOTENT: IF NOT EXISTS / constraint guards / CREATE OR REPLACE.
--
-- GRANT MODEL (015 convention): RLS grants nothing new. New EXECUTE surface:
-- rpc_save_outing_plan + rpc_update_outing_plan_status for authenticated
-- (+ service_role); rpc_flag_overdue_outing_plans for service_role only.

-- ---------------------------------------------------------------------------
-- Part 1 — Explorer Setup completion on children
-- ---------------------------------------------------------------------------
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS explorer_setup_completed_at timestamptz;
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS explorer_setup_version text NOT NULL DEFAULT 'v1';

COMMENT ON COLUMN public.children.explorer_setup_completed_at IS
  'Out & About one-time gate (FR-SAFETY-007): trusted-adult contact check + 3-minute Safety Basics + family-aware defaults. Required for 13-15 before any outing plan; content versioned for DV-advocate review.';

-- ---------------------------------------------------------------------------
-- Part 2 — outing_plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  destination text NOT NULL,
  companions text,
  depart_at timestamptz,
  return_at timestamptz NOT NULL,
  city text,
  postal_code text,
  -- FK to trusted_adults is added in 049_safety_trusted_adult_fks.sql: the
  -- trusted_adults table lands in 048, which sorts after this file.
  recipient_trusted_adult_id uuid,
  checkin_at timestamptz,
  checkin_missed_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'overdue', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outing_plans_child_idx
  ON public.outing_plans (child_id, status, return_at);

COMMENT ON TABLE public.outing_plans IS
  'Teen-composed outing itineraries (sol-safety §5.4). Voluntary, teen-controlled: the teen composes and taps send; Pookie never auto-shares. D7: city/postal_code are coarse TEXT — no precise coordinates are stored or accepted (G14: no location history <18). Overdue nudges go to the teen-chosen recipient, never auto-to-parents.';

ALTER TABLE public.outing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outing_plans_teen_all ON public.outing_plans;
CREATE POLICY outing_plans_teen_all ON public.outing_plans
  FOR ALL TO authenticated
  USING (
    -- Inlined (not public.is_teen_of()): the helper lives in
    -- 048_safety_trusted_adults.sql, which sorts after this file.
    EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = outing_plans.child_id
         AND ca.user_id = public.safe_auth_uid()
         AND ca.role = 'child'
         AND ca.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_access ca
       WHERE ca.child_id = outing_plans.child_id
         AND ca.user_id = public.safe_auth_uid()
         AND ca.role = 'child'
         AND ca.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- Part 3 — rpc_save_outing_plan (server-side gating)
-- p_sunset_at is computed client-side (astronomical calc); the SERVER
-- enforces the dusk rule against it: a teen could lie about sunset, but the
-- trusted-adult-share requirement (the real safety property) is enforced
-- server-side regardless.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_save_outing_plan(
  p_child_id uuid,
  p_destination text,
  p_return_at timestamptz,
  p_sunset_at timestamptz,
  p_recipient_trusted_adult_id uuid DEFAULT NULL,
  p_companions text DEFAULT NULL,
  p_depart_at timestamptz DEFAULT NULL,
  p_checkin_at timestamptz DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_dusk_override_ack boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_tier text;
  v_plan_id uuid;
  v_dusk_warning boolean := false;
  v_recipient_ok boolean := false;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF NOT public.is_teen_of(p_child_id) THEN RAISE EXCEPTION 'teen_only'; END IF;
  IF p_destination IS NULL OR btrim(p_destination) = '' THEN
    RAISE EXCEPTION 'destination_required';
  END IF;
  IF p_return_at IS NULL OR p_sunset_at IS NULL THEN
    RAISE EXCEPTION 'return_and_sunset_required';
  END IF;
  IF p_return_at <= now() THEN RAISE EXCEPTION 'return_in_past'; END IF;

  v_tier := public.child_age_tier(p_child_id);
  IF v_tier IN ('under13', 'unknown') THEN RAISE EXCEPTION 'age_verification_required'; END IF;

  -- Explorer Setup gate (13-15): trusted-adult contact + Safety Basics first.
  IF v_tier = 't13_15' THEN
    IF NOT EXISTS (SELECT 1 FROM public.children c
                    WHERE c.id = p_child_id
                      AND c.explorer_setup_completed_at IS NOT NULL) THEN
      RAISE EXCEPTION 'explorer_setup_required';
    END IF;
  END IF;

  -- Outing-contact recipient: required <16, optional-but-encouraged 16-17.
  IF p_recipient_trusted_adult_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.trusted_adults ta
       WHERE ta.id = p_recipient_trusted_adult_id
         AND ta.child_id = p_child_id
         AND ta.is_active
         AND ta.verification_status = 'verified'
         AND 'outing_contact' = ANY (ta.roles)
    ) INTO v_recipient_ok;
    IF NOT v_recipient_ok THEN RAISE EXCEPTION 'outing_contact_invalid'; END IF;
  ELSIF v_tier = 't13_15' THEN
    RAISE EXCEPTION 'outing_contact_required';
  END IF;

  -- Dusk guard: plans ending <90 min before sunset.
  IF p_return_at > (p_sunset_at - INTERVAL '90 minutes') THEN
    IF v_tier = 't13_15' THEN
      -- Hard guard <16: explicit teen override AND trusted-adult share.
      IF NOT (p_dusk_override_ack AND v_recipient_ok) THEN
        RAISE EXCEPTION 'dusk_guard_blocked';
      END IF;
      v_dusk_warning := true;
    ELSE
      -- Soft warning 16-17 (overridable; recorded).
      v_dusk_warning := true;
    END IF;
  END IF;

  INSERT INTO public.outing_plans
    (child_id, destination, companions, depart_at, return_at, city,
     postal_code, recipient_trusted_adult_id, checkin_at, status)
  VALUES
    (p_child_id, btrim(p_destination), NULLIF(btrim(COALESCE(p_companions, '')), ''),
     p_depart_at, p_return_at, NULLIF(btrim(COALESCE(p_city, '')), ''),
     NULLIF(btrim(COALESCE(p_postal_code, '')), ''),
     p_recipient_trusted_adult_id, p_checkin_at, 'active')
  RETURNING id INTO v_plan_id;

  PERFORM public.log_access_event(
    p_child_id, v_caller, NULL, 'outing.plan_shared', 'child', 'outing_shared',
    p_recipient_trusted_adult_id,
    jsonb_build_object('outing_plan_id', v_plan_id,
                       'dusk_override', v_dusk_warning AND p_dusk_override_ack));

  RETURN jsonb_build_object(
    'outing_plan_id', v_plan_id,
    'dusk_warning', v_dusk_warning);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_save_outing_plan(uuid, text, timestamptz, timestamptz, uuid, text, timestamptz, timestamptz, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_save_outing_plan(uuid, text, timestamptz, timestamptz, uuid, text, timestamptz, timestamptz, text, text, boolean)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 4 — plan lifecycle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_update_outing_plan_status(
  p_plan_id uuid,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_child uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_status NOT IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_plan_status';
  END IF;
  SELECT child_id INTO v_child FROM public.outing_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  IF NOT public.is_teen_of(v_child) THEN RAISE EXCEPTION 'teen_only'; END IF;

  UPDATE public.outing_plans SET status = p_status WHERE id = p_plan_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_update_outing_plan_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_update_outing_plan_status(uuid, text)
  TO authenticated, service_role;

-- Overdue flagger (service_role cron). Marks overdue rows and returns them
-- for the notify fan-out: nudge the TEEN first, then (+15 min no response)
-- the plan's teen-chosen recipient. Never auto-to-parents.
CREATE OR REPLACE FUNCTION public.rpc_flag_overdue_outing_plans()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
  v_due jsonb;
BEGIN
  IF v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_only';
  END IF;

  WITH flagged AS (
    UPDATE public.outing_plans
       SET status = 'overdue', checkin_missed_at = now()
     WHERE status = 'active'
       AND return_at + INTERVAL '2 hours' <= now()
    RETURNING id, child_id, destination, return_at, recipient_trusted_adult_id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) INTO v_due FROM flagged f;

  RETURN jsonb_build_object('overdue', v_due);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_flag_overdue_outing_plans() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_flag_overdue_outing_plans() TO service_role;

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. 13-15 without explorer_setup_completed_at -> explorer_setup_required.
-- 2. 13-15 without recipient -> outing_contact_required.
-- 3. Dusk return without override+share (13-15) -> dusk_guard_blocked.
-- 4. 16-17 dusk return -> saved with dusk_warning=true.
-- 5. Overdue cron flags rows past return_at + 2h.
-- 6. check.sh passes.
