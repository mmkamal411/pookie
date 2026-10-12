-- Migration 030: Path-to-90 forecast store + teen checkbox actions (FR-SCHOOL-007)
--
-- THE FORECAST ENGINE IS A PURE DETERMINISTIC FUNCTION (src/server/services/forecast.ts).
-- The LLM never computes grades. This migration stores the engine's outputs:
--
--   forecasts: every computed forecast carries engine_version, inputs_hash,
--     and computed_at. A sync that changes any cited input marks prior rows
--     stale (service layer compares inputs_hash). Old forecasts are never
--     silently reused; the API returns the latest non-stale row.
--
--   path_to_90_actions: the teen's top-3 action checkboxes.
--     PARENT RULE: parents are READ-ONLY. RLS enforces it (SELECT for parents
--     with tenant membership; INSERT/UPDATE/DELETE for the owning teen only).
--     The what-if simulator is client-side and never writes — only the teen's
--     own checkbox state persists.
--
-- ENGINE VERSION: forecast.v1.0 (MAJOR=algorithm change, MINOR=bugfix/tuning).
-- A version bump requires golden-fixture regeneration review by the math expert.
--
-- IDEMPOTENT: IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- forecasts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forecasts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id       uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  engine_version text NOT NULL,                 -- e.g. 'forecast.v1.0'
  inputs_hash    text NOT NULL,                 -- sha256 of the cited inputs
  computed_at    timestamptz NOT NULL DEFAULT now(),
  forecast       jsonb NOT NULL,                -- required_avg_on_remaining,
                                                -- what_if_table, top_3_levers,
                                                -- reachability
  citations      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- every input cited w/ source+ts
  stale          boolean NOT NULL DEFAULT false,
  superseded_by  uuid REFERENCES public.forecasts(id) ON DELETE SET NULL,
  provenance     text NOT NULL DEFAULT 'app_generated'
                 CHECK (provenance IN ('school_of_record','app_generated'))
);

CREATE INDEX IF NOT EXISTS forecasts_child_class_computed_idx
  ON public.forecasts (child_id, class_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS forecasts_inputs_hash_idx
  ON public.forecasts (child_id, class_id, inputs_hash);

ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forecasts_tenant_read ON public.forecasts;
CREATE POLICY forecasts_tenant_read ON public.forecasts
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

-- Forecasts are written by the server compute path only (no client INSERT —
-- the compute route inserts via the service layer with the caller's JWT;
-- a dedicated INSERT policy would let clients forge engine outputs).
-- Service_role (compute route) bypasses RLS; writes stamp child_id explicitly.

-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Teen checkbox ownership (FR-SCHOOL-007): the Path-to-90 checkboxes live in
-- study_plans.plan[] (the wired frontend contract — path-to-90.tsx toggles
-- via PATCH plans/[planId] { items: [{rank, done}] }). Parents are READ-ONLY
-- on the teen's checkboxes, enforced at BOTH layers:
--   (a) service: togglePlanItems() requires the teen role (403 otherwise);
--   (b) database: this trigger rejects any parent-role UPDATE that mutates
--       the plan items. Parents may still update safety_status (review gate)
--       and insert new plans; only the teen (or service_role pipeline) may
--       change checkbox state.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.study_plans_guard_teen_checkboxes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  IF NEW.plan IS NOT DISTINCT FROM OLD.plan THEN
    RETURN NEW;
  END IF;
  SELECT ca.role INTO v_role
    FROM public.child_access ca
   WHERE ca.user_id = public.safe_auth_uid()
     AND ca.child_id = NEW.child_id;
  -- service_role / pipeline (no JWT → NULL role) bypasses; parents blocked.
  IF v_role = 'parent' THEN
    RAISE EXCEPTION 'study_plan_checkboxes_teen_only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS study_plans_teen_checkboxes_guard ON public.study_plans;
CREATE TRIGGER study_plans_teen_checkboxes_guard
  BEFORE UPDATE OF plan ON public.study_plans
  FOR EACH ROW EXECUTE FUNCTION public.study_plans_guard_teen_checkboxes();
