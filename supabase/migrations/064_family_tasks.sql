-- Migration 064: Family Task System (Squad Value — 24h value directive)
--
-- Shared family tasks: to-dos, chores with assignment, recurring tasks, due dates.
-- This is the #1 daily-use driver missing from Pookie (cf. Cozi, FamilyWall).
--
-- Household pattern (from 007): tables anchor to owner_user_id (the parent user).
-- Membership derived from child_access via is_household_member().
--
-- Design:
--   family_tasks: one row per task, anchored to household owner
--   assigned_to: null = household (anyone), or a user_id, or 'child:<child_id>'
--   recurrence: null (one-time), daily, weekly, monthly
--   When a recurring task is completed, the next occurrence is auto-created.

-- ---------------------------------------------------------------------------
-- family_tasks table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 280),
  notes         text,
  due_date      date,
  due_time      time,
  assigned_to   text,  -- null = whole household; user_id; or 'child:<uuid>'
  priority      text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','snoozed')),
  recurrence    text CHECK (recurrence IN ('daily','weekly','monthly')),
  category      text,  -- free-form: 'chore', 'school', 'bill', 'health', etc.
  source        text NOT NULL DEFAULT 'manual',  -- 'manual' | 'pookie-chat' | 'meal-plan' etc.
  source_ref    uuid,  -- link back to originating record if any
  completed_at  timestamptz,
  completed_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  snoozed_until timestamptz,
  created_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  data_class    text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS family_tasks_owner_idx ON public.family_tasks (owner_user_id);
CREATE INDEX IF NOT EXISTS family_tasks_due_idx ON public.family_tasks (owner_user_id, due_date) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS family_tasks_status_idx ON public.family_tasks (owner_user_id, status);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.family_tasks_touch_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS family_tasks_touch ON public.family_tasks;
CREATE TRIGGER family_tasks_touch
  BEFORE UPDATE ON public.family_tasks
  FOR EACH ROW EXECUTE FUNCTION public.family_tasks_touch_updated();

-- ---------------------------------------------------------------------------
-- RLS: household members can CRUD tasks in their household
-- ---------------------------------------------------------------------------
ALTER TABLE public.family_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_tasks_select ON public.family_tasks;
CREATE POLICY family_tasks_select ON public.family_tasks
  FOR SELECT USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS family_tasks_insert ON public.family_tasks;
CREATE POLICY family_tasks_insert ON public.family_tasks
  FOR INSERT WITH CHECK (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS family_tasks_update ON public.family_tasks;
CREATE POLICY family_tasks_update ON public.family_tasks
  FOR UPDATE USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS family_tasks_delete ON public.family_tasks;
CREATE POLICY family_tasks_delete ON public.family_tasks
  FOR DELETE USING (public.is_household_member(owner_user_id));

-- ---------------------------------------------------------------------------
-- Recurrence helper: compute next due date
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.family_tasks_next_due(p_due date, p_recurrence text)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_recurrence
    WHEN 'daily'   THEN p_due + interval '1 day'
    WHEN 'weekly'  THEN p_due + interval '1 week'
    WHEN 'monthly' THEN p_due + interval '1 month'
    ELSE NULL
  END::date
$$;
