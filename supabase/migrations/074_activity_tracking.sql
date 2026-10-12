-- Migration 074: Activity Tracking (Phase1 — W22 fitness/activity module)
--
-- Workout log + manual daily step goal. Device integrations are a later
-- phase; this is hand-logged only. Household pattern (from 007/064):
-- tables anchor to owner_user_id; membership derived from child_access
-- via is_household_member().
--
-- Design:
--   workouts:       one row per logged workout; child_id null = the user
--                   themselves, otherwise the child they logged for.
--   activity_steps: one row per person per day; upserted by the service
--                   (PostgREST upsert on a nullable child_id is unreliable,
--                   so the service does select-then-write).
--   calories is an optional logged figure — never a burn target. No
--   calorie targets anywhere in this module (teen-safety framing).

-- ---------------------------------------------------------------------------
-- workouts table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workouts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  child_id      uuid REFERENCES public.children(id) ON DELETE CASCADE,
  type          text NOT NULL
                  CHECK (type IN ('run','walk','bike','swim','gym','sport','other')),
  duration_min  integer NOT NULL CHECK (duration_min BETWEEN 1 AND 1440),
  distance_mi   numeric(6,2) CHECK (distance_mi >= 0 AND distance_mi <= 1000),
  calories      integer CHECK (calories BETWEEN 0 AND 20000),
  notes         text CHECK (char_length(notes) <= 500),
  logged_at     timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workouts_owner_logged_idx
  ON public.workouts (owner_user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS workouts_child_logged_idx
  ON public.workouts (owner_user_id, child_id, logged_at DESC)
  WHERE child_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- activity_steps table (manual step logging; device sync later)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_steps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  child_id      uuid REFERENCES public.children(id) ON DELETE CASCADE,
  logged_date   date NOT NULL,
  steps         integer NOT NULL DEFAULT 0 CHECK (steps BETWEEN 0 AND 200000),
  step_goal     integer NOT NULL DEFAULT 8000
                  CHECK (step_goal BETWEEN 1000 AND 100000),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS activity_steps_owner_child_day_idx
  ON public.activity_steps (owner_user_id, logged_date, COALESCE(child_id, '00000000-0000-0000-0000-000000000000'));

CREATE OR REPLACE FUNCTION public.activity_steps_touch_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS activity_steps_touch ON public.activity_steps;
CREATE TRIGGER activity_steps_touch
  BEFORE UPDATE ON public.activity_steps
  FOR EACH ROW EXECUTE FUNCTION public.activity_steps_touch_updated();

-- ---------------------------------------------------------------------------
-- RLS: household members can CRUD their household's activity rows
-- ---------------------------------------------------------------------------
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workouts_select ON public.workouts;
CREATE POLICY workouts_select ON public.workouts
  FOR SELECT USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS workouts_insert ON public.workouts;
CREATE POLICY workouts_insert ON public.workouts
  FOR INSERT WITH CHECK (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS workouts_update ON public.workouts;
CREATE POLICY workouts_update ON public.workouts
  FOR UPDATE USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS workouts_delete ON public.workouts;
CREATE POLICY workouts_delete ON public.workouts
  FOR DELETE USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS activity_steps_select ON public.activity_steps;
CREATE POLICY activity_steps_select ON public.activity_steps
  FOR SELECT USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS activity_steps_insert ON public.activity_steps;
CREATE POLICY activity_steps_insert ON public.activity_steps
  FOR INSERT WITH CHECK (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS activity_steps_update ON public.activity_steps;
CREATE POLICY activity_steps_update ON public.activity_steps
  FOR UPDATE USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS activity_steps_delete ON public.activity_steps;
CREATE POLICY activity_steps_delete ON public.activity_steps
  FOR DELETE USING (public.is_household_member(owner_user_id));
