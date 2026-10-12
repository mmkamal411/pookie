-- Migration 027: Teen-owned check-in calibration system (FR-SCHOOL-003)
--
-- THE PARENT-FACING CROSS-CHECK / LIE DETECTOR IS DEAD AND NEVER SHIPS.
-- What ships is a metacognition tool the teen owns:
--   - At check-in the teen optionally estimates near-term outcomes
--     ("I think I got ~80% on today's quiz").
--   - When the synced actual arrives, per-estimate error e_i = |estimate - actual|.
--   - Rolling calibration score (last 10 paired estimates):
--       calibration = 1 - mean(e_i)/100, shown as "within ±X pts on average".
--   - Framing bands describe the SKILL of estimating, never honesty.
--   - Small-n guard: no score until >= 5 paired estimates.
--
-- DATA-FLOW GUARANTEE:
--   - checkin_estimates / calibration_scores RLS: SELECT restricted to the
--     OWNING TEEN ONLY (a real child_access row with role='child'). No parent
--     role, no service path, no briefing query may reference them.
--   - The parent-visible API serializer carries an explicit BLOCKLIST
--     (src/server/services/provenance.ts); calibration endpoints 403 parents
--     at the route layer as well (defense in depth).
--
-- RETENTION (G17 — never indefinite for minor-generated content):
--   - teen_privacy_settings.checkin_retention ∈ {rolling_90d (default),
--     rolling_365d, manual_delete_only}. Teen-owned, changeable anytime.
--   - purge_expired_checkins() runs nightly (service_role worker).
--   - Any single check-in is teen-deletable, effective immediately.
--
-- IDEMPOTENT: IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- checkin_estimates: the teen's estimate of a near-term outcome
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkin_estimates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  checkin_id    uuid REFERENCES public.checkins(id) ON DELETE SET NULL,
  class_id      uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  estimate_date date NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('quiz','test','assignment','other')),
  description   text NOT NULL,                       -- e.g. "Unit 3 quiz"
  estimate_pct  numeric NOT NULL CHECK (estimate_pct >= 0 AND estimate_pct <= 100),
  actual_pct    numeric CHECK (actual_pct IS NULL OR (actual_pct >= 0 AND actual_pct <= 100)),
  -- error_pct is GENERATED: |estimate - actual|, NULL until the actual lands.
  error_pct     numeric GENERATED ALWAYS AS (ABS(estimate_pct - actual_pct)) STORED,
  paired_at     timestamptz,                         -- when the actual arrived
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkin_estimates_child_created_idx
  ON public.checkin_estimates (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS checkin_estimates_unpaired_idx
  ON public.checkin_estimates (child_id) WHERE actual_pct IS NULL;

ALTER TABLE public.checkin_estimates ENABLE ROW LEVEL SECURITY;

-- Owning teen ONLY — every operation. Parents (any scope) get nothing.
DROP POLICY IF EXISTS checkin_estimates_teen_only ON public.checkin_estimates;
CREATE POLICY checkin_estimates_teen_only ON public.checkin_estimates
  FOR ALL
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.checkin_estimates.child_id
                  AND ca.role = 'child')
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.checkin_estimates.child_id
                  AND ca.role = 'child')
  );

-- ---------------------------------------------------------------------------
-- calibration_scores: rolling score snapshots (last 10 paired estimates)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calibration_scores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  computed_at  timestamptz NOT NULL DEFAULT now(),
  n_estimates  integer NOT NULL CHECK (n_estimates >= 0),
  mean_error   numeric,                               -- mean(e_i) in points
  calibration  numeric CHECK (calibration IS NULL OR (calibration >= 0 AND calibration <= 1)),
  band         text CHECK (band IN ('getting_sharper','steady','still_calibrating','warming_up'))
);

CREATE INDEX IF NOT EXISTS calibration_scores_child_computed_idx
  ON public.calibration_scores (child_id, computed_at DESC);

ALTER TABLE public.calibration_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calibration_scores_teen_only ON public.calibration_scores;
CREATE POLICY calibration_scores_teen_only ON public.calibration_scores
  FOR ALL
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.calibration_scores.child_id
                  AND ca.role = 'child')
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.calibration_scores.child_id
                  AND ca.role = 'child')
  );

-- ---------------------------------------------------------------------------
-- Recompute a teen's rolling calibration (last 10 paired estimates).
-- Called by the server after an actual lands. SECURITY DEFINER so the pairing
-- worker (service_role) can write; the teen's own recompute goes through it too.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_calibration(p_child_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
  v_mean numeric;
  v_cal numeric;
  v_band text;
  v_prev numeric;
  v_id uuid;
BEGIN
  SELECT count(*), avg(error_pct)
    INTO v_n, v_mean
    FROM (SELECT error_pct FROM public.checkin_estimates
           WHERE child_id = p_child_id AND actual_pct IS NOT NULL
           ORDER BY paired_at DESC NULLS LAST, created_at DESC
           LIMIT 10) recent;

  IF v_n IS NULL OR v_n < 5 THEN
    v_cal := NULL; v_band := 'warming_up'; v_mean := NULL;
  ELSE
    v_cal := 1 - (v_mean / 100);
    SELECT calibration INTO v_prev
      FROM public.calibration_scores
     WHERE child_id = p_child_id ORDER BY computed_at DESC LIMIT 1;
    v_band := CASE
      WHEN v_prev IS NULL THEN 'steady'
      WHEN v_cal > v_prev + 0.02 THEN 'getting_sharper'
      WHEN v_cal < v_prev - 0.02 THEN 'still_calibrating'
      ELSE 'steady'
    END;
  END IF;

  INSERT INTO public.calibration_scores (child_id, n_estimates, mean_error, calibration, band)
  VALUES (p_child_id, COALESCE(v_n, 0), v_mean, v_cal, v_band)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_calibration(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_calibration(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- teen_privacy_settings: teen-owned settings (retention lives here, NOT in
-- child_settings, because child_settings RLS is parent-write-only and the
-- retention setting is teen-owned per FR-SCHOOL-003).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teen_privacy_settings (
  child_id           uuid PRIMARY KEY REFERENCES public.children(id) ON DELETE CASCADE,
  checkin_retention  text NOT NULL DEFAULT 'rolling_90d'
    CHECK (checkin_retention IN ('rolling_90d','rolling_365d','manual_delete_only')),
  retention_nudged_at timestamptz,   -- yearly nudge for manual_delete_only (G17)
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teen_privacy_settings ENABLE ROW LEVEL SECURITY;

-- Teen: full control of own row.
DROP POLICY IF EXISTS teen_privacy_settings_teen_all ON public.teen_privacy_settings;
CREATE POLICY teen_privacy_settings_teen_all ON public.teen_privacy_settings
  FOR ALL
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.teen_privacy_settings.child_id
                  AND ca.role = 'child')
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.teen_privacy_settings.child_id
                  AND ca.role = 'child')
  );

-- Parents: read-only (so the Sharing screen can show the labeled state).
DROP POLICY IF EXISTS teen_privacy_settings_parent_read ON public.teen_privacy_settings;
CREATE POLICY teen_privacy_settings_parent_read ON public.teen_privacy_settings
  FOR SELECT
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.teen_privacy_settings.child_id
                  AND ca.role = 'parent')
  );

-- ---------------------------------------------------------------------------
-- Teen-deletable check-ins: the teen may DELETE any of their own check-in
-- rows, effective immediately. Parents cannot delete or restore them.
-- (Existing 006 policies cover tenant read + member insert/update.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS checkins_teen_delete ON public.checkins;
CREATE POLICY checkins_teen_delete ON public.checkins
  FOR DELETE
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.checkins.child_id
                  AND ca.role = 'child')
  );

-- ---------------------------------------------------------------------------
-- Nightly purge worker: DELETE checkins (and their estimates) older than the
-- teen's retention window. Called by the service_role nightly worker.
--   rolling_90d  → created_at < now() - 90 days
--   rolling_365d → created_at < now() - 365 days
--   manual_delete_only → no auto-purge (yearly nudge handled app-side)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_checkins()
RETURNS TABLE (child_id uuid, purged_checkins integer, purged_estimates integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_cutoff timestamptz;
  v_c integer;
  v_e integer;
BEGIN
  FOR r IN
    SELECT c.id AS child_id,
           COALESCE(tps.checkin_retention, 'rolling_90d') AS retention
      FROM public.children c
      LEFT JOIN public.teen_privacy_settings tps ON tps.child_id = c.id
  LOOP
    v_cutoff := CASE r.retention
      WHEN 'rolling_90d'  THEN now() - interval '90 days'
      WHEN 'rolling_365d' THEN now() - interval '365 days'
      ELSE NULL
    END;
    CONTINUE WHEN v_cutoff IS NULL;

    DELETE FROM public.checkin_estimates
     WHERE child_id = r.child_id AND created_at < v_cutoff;
    GET DIAGNOSTICS v_e = ROW_COUNT;

    DELETE FROM public.checkins
     WHERE child_id = r.child_id AND created_at < v_cutoff;
    GET DIAGNOSTICS v_c = ROW_COUNT;

    IF v_c > 0 OR v_e > 0 THEN
      child_id := r.child_id; purged_checkins := v_c; purged_estimates := v_e;
      RETURN NEXT;
    END IF;
  END LOOP;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_checkins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_checkins() TO service_role;

-- ---------------------------------------------------------------------------
-- Lab-safety pulse (FR-SCHOOL-019) storage: checkins.lab_read_safety_card +
-- checkins.lab_anonymous_question (added in 047_school_track_frontend.sql,
-- the wired check-in contract). No separate table — one check-in truth.
-- The free-text box is Reflection-scoped: blocklisted from parent payloads
-- (src/server/services/provenance.ts PARENT_BLOCKED_FIELDS).
