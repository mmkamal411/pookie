-- Migration 075 (screen-time): W15 Screen Time co-set plans.
--
-- Device-limit agreements only — no diagnoses, no health data. One row per
-- child (child_profile_id FK → children.id; no separate child_profiles table
-- exists — child_profile_id IS the tenant child id).
--
-- State machine (enforced in the API routes; RLS is the floor):
--   draft            — no proposal yet (or parent declined the last one)
--   proposed         — a plan is waiting on the parent's review
--   active           — both sides agreed; this is the live deal
--   change_requested — parent countered with their version; teen's turn
--
-- Roles: teen proposes (from draft), parent approves/counters/declines.
-- Never the reverse for initial setup (parent cannot propose from draft).
-- Parent CAN propose changes once a plan exists (active / change_requested).
-- Appeals (single open slot): teen files against an ACTIVE plan; parent
-- responds approve (→ change_requested, inviting a new proposal) or deny
-- (stays active).
--
-- RLS: the household owner (owner_user_id) has full CRUD; the teen — via a
-- child_access row on the child — can read + propose (INSERT/UPDATE on their
-- child's row, never DELETE). Route logic enforces the state machine above.

-- ---------------------------------------------------------------------------
-- screen_time_plans table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.screen_time_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id    uuid NOT NULL UNIQUE REFERENCES public.children(id) ON DELETE CASCADE,
  owner_user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'proposed', 'active', 'change_requested')),
  plan                jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { bedtimeWindDown, budgets[], focusBlocks[] }
  proposed_by         text CHECK (proposed_by IN ('teen', 'parent')),
  last_change_by      text CHECK (last_change_by IN ('teen', 'parent')),
  last_change_at      timestamptz,
  appeal_reason       text,
  appeal_at           timestamptz,
  appeal_response     text,
  appeal_responded_at timestamptz,
  data_class          text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S', 'T', 'P')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.screen_time_plans_touch_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS screen_time_plans_touch ON public.screen_time_plans;
CREATE TRIGGER screen_time_plans_touch
  BEFORE UPDATE ON public.screen_time_plans
  FOR EACH ROW EXECUTE FUNCTION public.screen_time_plans_touch_updated();

-- ---------------------------------------------------------------------------
-- RLS helper: caller has a child_access row on the child (parent OR teen).
-- SECURITY DEFINER so the check isn't blocked by child_access's own RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.screen_time_can_access(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.child_id = p_child_id
      AND ca.user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.screen_time_can_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.screen_time_can_access(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: owner full CRUD; teen (via child_access) reads + proposes.
-- The state machine (who may propose/approve/appeal in which status) is
-- enforced route-side; these policies are the floor.
-- ---------------------------------------------------------------------------
ALTER TABLE public.screen_time_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS screen_time_plans_select ON public.screen_time_plans;
CREATE POLICY screen_time_plans_select ON public.screen_time_plans
  FOR SELECT USING (
    owner_user_id = auth.uid()
    OR public.screen_time_can_access(child_profile_id)
  );

DROP POLICY IF EXISTS screen_time_plans_insert ON public.screen_time_plans;
CREATE POLICY screen_time_plans_insert ON public.screen_time_plans
  FOR INSERT WITH CHECK (
    owner_user_id = auth.uid()
    OR public.screen_time_can_access(child_profile_id)
  );

DROP POLICY IF EXISTS screen_time_plans_update ON public.screen_time_plans;
CREATE POLICY screen_time_plans_update ON public.screen_time_plans
  FOR UPDATE
  USING (
    owner_user_id = auth.uid()
    OR public.screen_time_can_access(child_profile_id)
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    OR public.screen_time_can_access(child_profile_id)
  );

DROP POLICY IF EXISTS screen_time_plans_delete ON public.screen_time_plans;
CREATE POLICY screen_time_plans_delete ON public.screen_time_plans
  FOR DELETE USING (owner_user_id = auth.uid());
