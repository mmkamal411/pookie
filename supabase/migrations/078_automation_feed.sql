-- Migration 078: Background AI — nudge feed + adaptive layout storage.
--
-- automation_nudges: the plain-English activity feed ("Overnight by Pookie").
-- One row per nudge; the unique (household_id, dedup_key) index makes cron
-- double-fires a no-op instead of a duplicate.
--
-- cockpit_layout_overrides: pilot overrides for the adaptive layout engine —
-- the AI proposes, the pilot disposes. Locks and hides always win over AI
-- scoring.
--
-- cockpit_layout_plans: the current computed LayoutPlan per household
-- (recomputed nightly, never appended).
--
-- All three are household-anchored (household_id = owner_user_id); RLS via
-- is_household_member(), same as bills (migration 065).

CREATE TABLE IF NOT EXISTS public.automation_nudges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  watcher       text NOT NULL,
  tier          text NOT NULL CHECK (tier IN ('banner','feed','digest')),
  priority      integer NOT NULL CHECK (priority BETWEEN 0 AND 100),
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  detail        text NOT NULL,
  approval      text NOT NULL CHECK (approval IN ('silent','one-tap','suggest-only')),
  action        jsonb,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','acted','dismissed')),
  dedup_key     text NOT NULL,
  read_at       timestamptz,
  dismissed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS automation_nudges_household_idx
  ON public.automation_nudges (household_id, status, priority DESC, created_at DESC);

ALTER TABLE public.automation_nudges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_nudges_select ON public.automation_nudges;
CREATE POLICY automation_nudges_select ON public.automation_nudges
  FOR SELECT USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS automation_nudges_update ON public.automation_nudges;
CREATE POLICY automation_nudges_update ON public.automation_nudges
  FOR UPDATE USING (public.is_household_member(household_id));

-- No client INSERT/DELETE: nudges are written by the automation host
-- (service role) and dismissed via status updates only (ledger-like).

CREATE TABLE IF NOT EXISTS public.cockpit_layout_overrides (
  household_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  panel_id        text NOT NULL,
  locked_position integer CHECK (locked_position IS NULL OR locked_position >= 1),
  hidden          boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, panel_id)
);

ALTER TABLE public.cockpit_layout_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cockpit_layout_overrides_all ON public.cockpit_layout_overrides;
CREATE POLICY cockpit_layout_overrides_all ON public.cockpit_layout_overrides
  FOR ALL USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE TABLE IF NOT EXISTS public.cockpit_layout_plans (
  household_id  uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  plan          jsonb NOT NULL,
  template      text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cockpit_layout_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cockpit_layout_plans_select ON public.cockpit_layout_plans;
CREATE POLICY cockpit_layout_plans_select ON public.cockpit_layout_plans
  FOR SELECT USING (public.is_household_member(household_id));

-- No client INSERT/UPDATE/DELETE: plans are computed by the automation host.
