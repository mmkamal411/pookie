-- DRAFT — DO NOT APPLY until counsel clears H0–H3 (NFR-LEGAL gate).
-- =============================================================================
-- Implements sol-health.md §6 (W23 nutrition age-gate + W13 rules), Appendix A.
-- Depends on 022 (tiers). Amends UNAPPLIED 012 in place (§6.7).
-- Legal gate: counsel sign-off on H0–H3 required before production data flows
-- (NFR-LEGAL); schema itself is complete and tested.
-- =============================================================================
-- Migration 027: nutrition age-gate
--
-- Contents:
--   1. food_logs: calories_low/high + macros → nullable (§6.7 #1)
--   2. enforce_no_calories_minor() BEFORE INSERT/UPDATE trigger (§6.7 #1):
--      minor band + any calorie/macro column non-NULL →
--      RAISE EXCEPTION 'nutrition_minor_calorie_refusal'
--   3. nutrition_targets: clinician_gate_id FK; 'clinician_supervised' kind;
--      CHECK: medical_recovery OR 18+ deficit-adjacent → gate required;
--      the 012 invariant (no deficit kind <18) is preserved — deficit kinds
--      are unrepresentable for minors by schema (§6.7 #2)
--   4. nutrition_weekly_patterns(): engagement-only for minor subjects —
--      calorie/macro averages return NULL with detail='engagement_only_minor'
--      (§6.7 #3, sol-health C3)
--   5. meal_checkins — the <18 experience: NO calorie/macro/weight columns;
--      a minor cannot log what the schema cannot hold (§6.2)
--   6. clinician_gates — NPI-verified clinician orders (§6.4)
--   7. ed_signal detection from meal_checkins patterns (§6.6)
--
-- REVIEW CHECKPOINTS:
--   RC-027-1 (Team 1): calorie/macro columns physically cannot hold values
--              for minors (trigger proven with direct SQL insert attempts);
--              route-level refusal is the backstop-first layer.
--   RC-027-2 (Team 2): nutrition_weekly_patterns() returns no numeric
--              nutrition data for minor subjects regardless of caller role.
--   RC-027-3 (Team 1): clinician gate requires active NPI in a licensed
--              credential taxonomy; 18+ deficit targets cannot exist without
--              a gate; coaches/trainers do not satisfy the gate.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. food_logs: make calorie/macro ranges nullable (012 amend §6.7 #1).
--    012 is UNAPPLIED: amend in place.
-- ---------------------------------------------------------------------------
ALTER TABLE public.food_logs
  ALTER COLUMN calories_low  DROP NOT NULL,
  ALTER COLUMN calories_high DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS health_tier public.health_tier NOT NULL DEFAULT 'H2',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.nutrition_targets
  ADD COLUMN IF NOT EXISTS health_tier public.health_tier NOT NULL DEFAULT 'H2';

-- ---------------------------------------------------------------------------
-- 2. enforce_no_calories_minor() — the schema backstop (§6.7 #1).
--    Route checks first; this trigger is the enforcement point.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_no_calories_minor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band text;
BEGIN
  v_band := public.health_subject_age_band(NEW.subject_id);
  IF v_band = 'unknown' THEN
    v_band := 'teen_13_15';  -- fail closed
  END IF;

  IF v_band IN ('under13','teen_13_15','teen_16_17') THEN
    IF NEW.calories_low IS NOT NULL OR NEW.calories_high IS NOT NULL
       OR NEW.protein_g_low IS NOT NULL OR NEW.protein_g_high IS NOT NULL
       OR NEW.carbs_g_low IS NOT NULL OR NEW.carbs_g_high IS NOT NULL
       OR NEW.fat_g_low IS NOT NULL OR NEW.fat_g_high IS NOT NULL THEN
      RAISE EXCEPTION 'nutrition_minor_calorie_refusal';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- RECONCILED 2026-10-12: the 012 edit-in-place created
-- food_logs_no_calories_minor; this migration's trg_enforce_no_calories_minor
-- supersedes it (column-scoped firing). Drop the 012 one to avoid double fire.
DROP TRIGGER IF EXISTS food_logs_no_calories_minor ON public.food_logs;
DROP TRIGGER IF EXISTS trg_enforce_no_calories_minor ON public.food_logs;
CREATE TRIGGER trg_enforce_no_calories_minor
  BEFORE INSERT OR UPDATE OF calories_low, calories_high,
    protein_g_low, protein_g_high, carbs_g_low, carbs_g_high,
    fat_g_low, fat_g_high
  ON public.food_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_no_calories_minor();

-- ---------------------------------------------------------------------------
-- 3. clinician_gates + nutrition_targets gate wiring (§6.4, §6.7 #2).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinician_gates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id         uuid NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  clinician_name     text NOT NULL,
  credential         text NOT NULL CHECK (credential IN ('MD','DO','NP','PA','RD','LD')),
  npi                text NOT NULL,
  verified_at        timestamptz NOT NULL DEFAULT now(),
  verification_method text NOT NULL DEFAULT 'npi_registry',
  scope_note         text,
  expires_at         timestamptz NOT NULL DEFAULT (now() + interval '12 months'),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinician_gates_subject_idx
  ON public.clinician_gates (subject_id);

ALTER TABLE public.clinician_gates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinician_gates_tenant_read ON public.clinician_gates;
CREATE POLICY clinician_gates_tenant_read ON public.clinician_gates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.clinician_gates.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  );

-- Gate writes: teen (16–17 with their clinician) or parent; the NPI registry
-- verification happens in the route before insert. No direct anonymous writes.
DROP POLICY IF EXISTS clinician_gates_tenant_insert ON public.clinician_gates;
CREATE POLICY clinician_gates_tenant_insert ON public.clinician_gates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            JOIN public.child_access ca
              ON ca.child_id = hs.child_id AND ca.user_id = auth.uid()
              AND ca.role IN ('parent','child')
            WHERE hs.id = public.clinician_gates.subject_id)
  );

GRANT SELECT, INSERT, UPDATE ON public.clinician_gates TO authenticated;

-- nutrition_targets: gate FK + 'clinician_supervised' kind (§6.7 #2).
ALTER TABLE public.nutrition_targets
  ADD COLUMN IF NOT EXISTS clinician_gate_id uuid REFERENCES public.clinician_gates(id);
-- RECONCILED 2026-10-12: the 012 edit-in-place already added the bare uuid
-- column, so the IF NOT EXISTS above skipped the REFERENCES. Add the FK
-- explicitly (idempotent guard).
DO $$ BEGIN
  ALTER TABLE public.nutrition_targets
    ADD CONSTRAINT nutrition_targets_clinician_gate_fk
    FOREIGN KEY (clinician_gate_id) REFERENCES public.clinician_gates(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.nutrition_targets
    DROP CONSTRAINT nutrition_targets_target_kind_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.nutrition_targets
  ADD CONSTRAINT nutrition_targets_target_kind_check
    CHECK (target_kind IN ('maintain','athletic_performance','healthy_gain',
                           'medical_recovery','clinician_supervised'));

-- Gate requirement: 'medical_recovery' OR 'clinician_supervised' (the only
-- deficit-adjacent kind) → clinician_gate_id NOT NULL and the gate must be
-- unexpired at write time. No deficit kind is representable for minors:
-- 'clinician_supervised' is refused for minor bands by trigger below.
DO $$ BEGIN
  ALTER TABLE public.nutrition_targets
    ADD CONSTRAINT nutrition_targets_gate_required
      CHECK (
        target_kind NOT IN ('medical_recovery','clinician_supervised')
        OR clinician_gate_id IS NOT NULL
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_nutrition_target_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band text;
  v_gate_expires timestamptz;
BEGIN
  v_band := public.health_subject_age_band(NEW.subject_id);
  IF v_band = 'unknown' THEN v_band := 'teen_13_15'; END IF;

  -- No deficit-adjacent target for minors: unrepresentable by schema.
  IF v_band IN ('under13','teen_13_15','teen_16_17')
     AND NEW.target_kind = 'clinician_supervised' THEN
    RAISE EXCEPTION 'nutrition_minor_deficit_refusal';
  END IF;

  -- The gate must exist and be unexpired.
  IF NEW.clinician_gate_id IS NOT NULL THEN
    SELECT g.expires_at INTO v_gate_expires
    FROM public.clinician_gates g WHERE g.id = NEW.clinician_gate_id;
    IF v_gate_expires IS NULL THEN
      RAISE EXCEPTION 'nutrition_gate_not_found';
    END IF;
    IF v_gate_expires <= now() THEN
      RAISE EXCEPTION 'nutrition_gate_expired';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_nutrition_target_gate ON public.nutrition_targets;
CREATE TRIGGER trg_enforce_nutrition_target_gate
  BEFORE INSERT OR UPDATE OF target_kind, clinician_gate_id ON public.nutrition_targets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_nutrition_target_gate();

-- ---------------------------------------------------------------------------
-- 4. nutrition_weekly_patterns(): engagement-only for minor subjects (§6.7 #3).
--    Replaces the 012 version. Parents of <18 get days_logged / entries /
--    meals_by_type — calorie/macro averages are NULL with an explicit reason.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nutrition_weekly_patterns(p_subject_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
  v_band     text;
  v_result   jsonb;
BEGIN
  IF p_subject_id IS NULL THEN
    RAISE EXCEPTION 'health_subject_required';
  END IF;

  SELECT hs.child_id INTO v_child_id
  FROM public.health_subjects hs
  WHERE hs.id = p_subject_id;

  IF v_child_id IS NULL
     OR NOT (v_child_id = ANY (public.current_child_ids())) THEN
    RAISE EXCEPTION 'health_subject_access_denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid()
      AND ca.child_id = v_child_id
      AND ca.role IN ('parent','child')
  ) THEN
    RAISE EXCEPTION 'nutrition_patterns_access_denied';
  END IF;

  v_band := public.health_subject_age_band(p_subject_id);
  IF v_band = 'unknown' THEN v_band := 'teen_13_15'; END IF;

  IF v_band IN ('under13','teen_13_15','teen_16_17') THEN
    -- ENGAGEMENT ONLY for minors (sol-health C3). No calorie/macro/weight
    -- aggregates are computed or returned — the server refuses them.
    WITH week AS (
      SELECT mc.*
      FROM public.meal_checkins mc
      WHERE mc.subject_id = p_subject_id
        AND mc.logged_at >= date_trunc('day', now()) - interval '6 days'
        AND mc.deleted_at IS NULL
    )
    SELECT jsonb_build_object(
      'week_start', (date_trunc('day', now()) - interval '6 days')::date,
      'days_logged', (SELECT count(DISTINCT (w.logged_at::date)) FROM week w),
      'entries', (SELECT count(*) FROM week w),
      'meals_by_type', (SELECT coalesce(jsonb_object_agg(w.meal, w.cnt), '{}'::jsonb)
                        FROM (SELECT meal, count(*) AS cnt FROM week GROUP BY meal) w),
      'avg_calories_low',  NULL,
      'avg_calories_high', NULL,
      'avg_protein_g', NULL,
      'avg_carbs_g',   NULL,
      'avg_fat_g',     NULL,
      'detail', 'engagement_only_minor'
    ) INTO v_result;
  ELSE
    -- 18+ with re-consent: full output from the 18+ diary (food_logs).
    WITH week AS (
      SELECT fl.*
      FROM public.food_logs fl
      WHERE fl.subject_id = p_subject_id
        AND fl.deleted_at IS NULL
        AND fl.logged_at >= date_trunc('day', now()) - interval '6 days'
    )
    SELECT jsonb_build_object(
      'week_start', (date_trunc('day', now()) - interval '6 days')::date,
      'days_logged', (SELECT count(DISTINCT (w.logged_at::date)) FROM week w),
      'entries', (SELECT count(*) FROM week w),
      'avg_calories_low',  (SELECT round(avg(w.calories_low), 1)  FROM week w),
      'avg_calories_high', (SELECT round(avg(w.calories_high), 1) FROM week w),
      'avg_protein_g', (SELECT round(avg((w.protein_g_low + w.protein_g_high) / 2), 1)
                        FROM week w WHERE w.protein_g_low IS NOT NULL),
      'avg_carbs_g',   (SELECT round(avg((w.carbs_g_low + w.carbs_g_high) / 2), 1)
                        FROM week w WHERE w.carbs_g_low IS NOT NULL),
      'avg_fat_g',     (SELECT round(avg((w.fat_g_low + w.fat_g_high) / 2), 1)
                        FROM week w WHERE w.fat_g_low IS NOT NULL),
      'detail', 'full'
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.nutrition_weekly_patterns(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nutrition_weekly_patterns(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. meal_checkins — the <18 experience (§6.2). No calorie, macro, or weight
--    columns exist. A minor cannot log what the schema cannot hold.
--    Framing: "Did you eat regularly today?" / "How was your energy?"
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meal_checkins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     uuid NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  logged_at      timestamptz NOT NULL DEFAULT now(),
  meal           text NOT NULL CHECK (meal IN ('breakfast','lunch','dinner','snack')),
  food_groups    text[] NOT NULL DEFAULT '{}',
  hunger_before  smallint CHECK (hunger_before BETWEEN 1 AND 5),
  fullness_after smallint CHECK (fullness_after BETWEEN 1 AND 5),
  energy_note    text,
  logged_by      uuid REFERENCES public.users(id),
  health_tier    public.health_tier NOT NULL DEFAULT 'H2',
  deleted_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meal_checkins_subject_logged_idx
  ON public.meal_checkins (subject_id, logged_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.meal_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meal_checkins_tier_read ON public.meal_checkins;
CREATE POLICY meal_checkins_tier_read ON public.meal_checkins
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      public.health_tier_visible(subject_id, 'meal_checkin', health_tier)
      OR public.health_grace_read_allowed(subject_id, health_tier, logged_at)
    )
  );

DROP POLICY IF EXISTS meal_checkins_tenant_insert ON public.meal_checkins;
CREATE POLICY meal_checkins_tenant_insert ON public.meal_checkins
  FOR INSERT WITH CHECK (
    health_tier = 'H2'   -- check-ins are H2, never H1
    AND EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.meal_checkins.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  );

DROP POLICY IF EXISTS meal_checkins_tenant_update ON public.meal_checkins;
CREATE POLICY meal_checkins_tenant_update ON public.meal_checkins
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.health_subjects hs
                 WHERE hs.id = public.meal_checkins.subject_id
                   AND hs.child_id = ANY (public.current_child_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.health_subjects hs
                      WHERE hs.id = public.meal_checkins.subject_id
                        AND hs.child_id = ANY (public.current_child_ids())));

GRANT SELECT, INSERT, UPDATE ON public.meal_checkins TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. ED-signal detection from meal_checkins patterns (§6.6).
--    ≥3 skipped meals in 7 days with low-energy notes → ed_signal (medium).
--    Metadata only; never a parent notification, never a diagnostic claim.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.detect_nutrition_ed_signals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fired int := 0;
  v_row record;
BEGIN
  FOR v_row IN
    SELECT hs.child_id
    FROM public.meal_checkins mc
    JOIN public.health_subjects hs ON hs.id = mc.subject_id
    WHERE mc.deleted_at IS NULL
      AND mc.logged_at >= now() - interval '7 days'
    GROUP BY hs.child_id
    HAVING count(*) FILTER (WHERE mc.energy_note ILIKE '%skip%'
                                OR mc.energy_note ILIKE '%didn''t eat%'
                                OR mc.energy_note ILIKE '%no appetite%') >= 3
  LOOP
    PERFORM public.emit_wellbeing_event(v_row.child_id, 'ed_signal', 'medium');
    v_fired := v_fired + 1;
  END LOOP;

  RETURN jsonb_build_object('ed_signals_emitted', v_fired, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.detect_nutrition_ed_signals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_nutrition_ed_signals() TO service_role;

DO $$
BEGIN
  PERFORM cron.schedule('detect_nutrition_ed_signals', '45 2 * * *',
    $cron$SELECT public.detect_nutrition_ed_signals()$cron$);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Review checkpoint sign-offs.
-- ---------------------------------------------------------------------------
-- | Checkpoint | Reviewer | Date | Result |
-- | RC-027-1   | (Fractional Team 1) | | |
-- | RC-027-2   | (Team 2 RLS audit) | | |
-- | RC-027-3   | (Fractional Team 1) | | |
