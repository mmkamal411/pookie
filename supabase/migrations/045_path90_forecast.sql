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
-- path_to_90_actions: teen-owned checkboxes. Parents READ-ONLY.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.path_to_90_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id    uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  action_text text NOT NULL CHECK (char_length(action_text) BETWEEN 1 AND 500),
  rank        integer NOT NULL CHECK (rank >= 1),
  done        boolean NOT NULL DEFAULT false,
  done_at     timestamptz,
  created_by  uuid REFERENCES public.users(id),   -- the teen (or parent suggestion)
  created_at  timestamptz NOT NULL DEFAULT now(),
  provenance  text NOT NULL DEFAULT 'app_generated'
              CHECK (provenance IN ('school_of_record','app_generated'))
);

CREATE INDEX IF NOT EXISTS path_to_90_actions_child_class_idx
  ON public.path_to_90_actions (child_id, class_id, rank);

ALTER TABLE public.path_to_90_actions ENABLE ROW LEVEL SECURITY;

-- Teen (owner): full CRUD on own rows.
DROP POLICY IF EXISTS path_to_90_teen_all ON public.path_to_90_actions;
CREATE POLICY path_to_90_teen_all ON public.path_to_90_actions
  FOR ALL
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.path_to_90_actions.child_id
                  AND ca.role = 'child')
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.path_to_90_actions.child_id
                  AND ca.role = 'child')
  );

-- Parent: SELECT ONLY. There is deliberately NO parent INSERT/UPDATE/DELETE
-- policy — the route layer also 403s non-teen writes (defense in depth).
DROP POLICY IF EXISTS path_to_90_parent_read ON public.path_to_90_actions;
CREATE POLICY path_to_90_parent_read ON public.path_to_90_actions
  FOR SELECT
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.path_to_90_actions.child_id
                  AND ca.role = 'parent')
  );
