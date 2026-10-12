-- Migration 066: School telemetry schema — Squad Telemetry (E4 Database Architect)
--
-- Closes the gaps in the school data model so the Pookie school pages have ONE
-- source of truth. Extends (never duplicates) the existing school tables from
-- 002 (classes), 006 (grades, grade_snapshots, assignments, teacher_messages,
-- checkins), 026/041 (provenance). New tables cover attendance, district
-- calendar, per-class check-in detail, and the sync-health contract that
-- powers the status dashboard.
--
-- TABLE CONTRACT (for E1/E2/E3 pull scripts):
--   classes.room / .current_unit / .color            (display metadata)
--   grade_snapshots.category_averages                 (per-sync category avg+weight, jsonb)
--   assignments.assignment_type                      (homework|quiz|test|project|lab|final|classwork|other)
--   teacher_messages.external_id / .received_at / .summary   (inbound email dedupe + digest)
--   school_attendance                                (per child per day + period detail)
--   school_calendar                                  (district events; rolling 2-year retention)
--   checkin_class_details                            (per-class check-in detail; FK to checkins)
--   school_sync_health                               (THE status-dashboard contract: 1 row per child+source+machine)
--   school_sync_runs                                 (append-only per-run log; 90-day retention)
--
-- RLS: child-scoped via child_id = ANY (public.current_child_ids()) (001 pattern).
-- Sync-owned tables: tenant SELECT; writes are service_role-only (no client
-- write policies — mirrors 006 grades/grade_snapshots discipline).
-- checkin_class_details: member insert/update (mirrors 006 checkins).
--
-- IDEMPOTENT: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS /
-- DROP TRIGGER IF EXISTS / OR REPLACE throughout. Safe to re-run.
-- check.sh compliant.

-- ---------------------------------------------------------------------------
-- 0. Shared updated_at touch function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;

-- ---------------------------------------------------------------------------
-- 1. classes: display metadata the class pages need
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS room         text,
  ADD COLUMN IF NOT EXISTS current_unit text,
  ADD COLUMN IF NOT EXISTS color        text CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$');

-- ---------------------------------------------------------------------------
-- 2. grade_snapshots: per-sync category averages (feeds Path-to-90)
--    Shape: {"Quiz": {"avg": 82.5, "weight": 25}, "Test": {"avg": 55.0, "weight": 40}}
-- ---------------------------------------------------------------------------
ALTER TABLE public.grade_snapshots
  ADD COLUMN IF NOT EXISTS category_averages jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- 3. assignments: assignment type for the due-next / class-page UX
-- ---------------------------------------------------------------------------
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS assignment_type text
    CHECK (assignment_type IN ('homework','quiz','test','project','lab','final','classwork','other'));

-- ---------------------------------------------------------------------------
-- 4. teacher_messages: inbound email contract (E3)
--    external_id = provider message id (e.g. Gmail); dedupe key.
-- ---------------------------------------------------------------------------
ALTER TABLE public.teacher_messages
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS summary     text;

CREATE UNIQUE INDEX IF NOT EXISTS teacher_messages_child_external_uidx
  ON public.teacher_messages (child_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS teacher_messages_received_idx
  ON public.teacher_messages (child_id, received_at DESC)
  WHERE direction = 'inbound';

-- ---------------------------------------------------------------------------
-- 5. school_attendance: per child per day, with period-level detail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_attendance (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  att_date       date NOT NULL,
  status         text NOT NULL
                 CHECK (status IN ('present','tardy','absent','early_dismissal','excused','unexcused')),
  period_details jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{period, status, note}]
  source         text NOT NULL DEFAULT 'parentvue',   -- adapter key
  notes          text,
  synced_at      timestamptz NOT NULL DEFAULT now(),
  provenance     text NOT NULL DEFAULT 'school_of_record'
                 CHECK (provenance IN ('school_of_record','app_generated')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, att_date, source)
);

CREATE INDEX IF NOT EXISTS school_attendance_child_date_idx
  ON public.school_attendance (child_id, att_date DESC);

DROP TRIGGER IF EXISTS school_attendance_touch ON public.school_attendance;
CREATE TRIGGER school_attendance_touch
  BEFORE UPDATE ON public.school_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.school_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_attendance_tenant_read ON public.school_attendance;
CREATE POLICY school_attendance_tenant_read ON public.school_attendance
  FOR SELECT TO authenticated
  USING (child_id = ANY (public.current_child_ids()));
-- No client write policies: sync pipeline writes via service_role only.

GRANT SELECT ON public.school_attendance TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. school_calendar: district events (holiday / early release / no school...)
--    Retention: rolling 2 years (purge_old_school_calendar()).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_calendar (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  event_date  date NOT NULL,
  end_date    date,                                     -- multi-day events
  title       text NOT NULL,
  event_type  text NOT NULL
              CHECK (event_type IN ('holiday','no_school','early_release','late_start','testing','event','deadline')),
  description text,
  source      text NOT NULL DEFAULT 'ccsd',             -- 'ccsd' | 'school' | 'manual'
  source_ref  text,                                     -- URL or provider id
  provenance  text NOT NULL DEFAULT 'school_of_record'
              CHECK (provenance IN ('school_of_record','app_generated')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_calendar_end_after_start CHECK (end_date IS NULL OR end_date >= event_date)
);

CREATE INDEX IF NOT EXISTS school_calendar_child_date_idx
  ON public.school_calendar (child_id, event_date);

DROP TRIGGER IF EXISTS school_calendar_touch ON public.school_calendar;
CREATE TRIGGER school_calendar_touch
  BEFORE UPDATE ON public.school_calendar
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.school_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_calendar_tenant_read ON public.school_calendar;
CREATE POLICY school_calendar_tenant_read ON public.school_calendar
  FOR SELECT TO authenticated
  USING (child_id = ANY (public.current_child_ids()));
-- No client write policies: E3 calendar pull writes via service_role only.

GRANT SELECT ON public.school_calendar TO authenticated;

-- Rolling 2-year retention: delete events older than 2 years. Run from a
-- scheduled job via service_role (returns rows deleted).
CREATE OR REPLACE FUNCTION public.purge_old_school_calendar()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deleted bigint;
BEGIN
  DELETE FROM public.school_calendar
  WHERE event_date < CURRENT_DATE - interval '2 years';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_old_school_calendar() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 7. checkin_class_details: per-class check-in detail (what worked on,
--    what's confusing, what's due). Parent of record: checkins (1 row/child/day).
--    Privacy: raw text is child-confidential (W8 contract on checkins) —
--    parent-visible API returns aggregates, enforced in the route layer.
--    Retention: keep all (Mehedi decision on check-in retention pending).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkin_class_details (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id  uuid NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id    uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  worked_on   text,
  confusing   text,
  due_next    text,
  confidence  smallint CHECK (confidence BETWEEN 1 AND 5),
  provenance  text NOT NULL DEFAULT 'app_generated'
              CHECK (provenance IN ('school_of_record','app_generated')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checkin_id, class_id)
);

CREATE INDEX IF NOT EXISTS checkin_class_details_child_class_idx
  ON public.checkin_class_details (child_id, class_id);

DROP TRIGGER IF EXISTS checkin_class_details_touch ON public.checkin_class_details;
CREATE TRIGGER checkin_class_details_touch
  BEFORE UPDATE ON public.checkin_class_details
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.checkin_class_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkin_class_details_tenant_read ON public.checkin_class_details;
CREATE POLICY checkin_class_details_tenant_read ON public.checkin_class_details
  FOR SELECT TO authenticated
  USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS checkin_class_details_member_insert ON public.checkin_class_details;
CREATE POLICY checkin_class_details_member_insert ON public.checkin_class_details
  FOR INSERT TO authenticated
  WITH CHECK (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS checkin_class_details_member_update ON public.checkin_class_details;
CREATE POLICY checkin_class_details_member_update ON public.checkin_class_details
  FOR UPDATE TO authenticated
  USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));

GRANT SELECT, INSERT, UPDATE ON public.checkin_class_details TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. school_sync_health: THE status-dashboard contract.
--    One row per (child_id, source_name, machine). Writers: E1/E2/E3 via
--    telemetry/health.py (service_role upsert). Tenant read.
--
--    Freshness rule (shared by health.py and recompute_school_sync_health()):
--      latest run failed  -> 'error'
--      never succeeded    -> 'never'
--      now - last_success_at > expected_freshness -> 'stale'
--      else               -> 'fresh'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_sync_health (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id             uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  source_name          text NOT NULL,   -- 'studentvue' | 'parentvue' | 'gmail-teacher' |
                                       -- 'ctls-learn' | 'ccsd-calendar' | 'checkin-app'
  machine              text NOT NULL
                       CHECK (machine IN ('laptop','macbook','sandbox','cloud')),
  cadence              text NOT NULL DEFAULT 'daily'
                       CHECK (cadence IN ('hourly','daily','weekly','manual')),
  expected_freshness   interval NOT NULL DEFAULT '26 hours',
  last_run_started     timestamptz,
  last_run_finished    timestamptz,
  last_success_at      timestamptz,
  rows_pulled          int NOT NULL DEFAULT 0,
  rows_by_table        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {"grades":6,"assignments":42}
  error_text           text,
  consecutive_errors   int NOT NULL DEFAULT 0,
  next_scheduled_run   timestamptz,
  data_freshness_status text NOT NULL DEFAULT 'never'
                       CHECK (data_freshness_status IN ('fresh','stale','error','never')),
  provenance           text NOT NULL DEFAULT 'app_generated'
                       CHECK (provenance IN ('school_of_record','app_generated')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, source_name, machine)
);

CREATE INDEX IF NOT EXISTS school_sync_health_child_idx
  ON public.school_sync_health (child_id);

DROP TRIGGER IF EXISTS school_sync_health_touch ON public.school_sync_health;
CREATE TRIGGER school_sync_health_touch
  BEFORE UPDATE ON public.school_sync_health
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.school_sync_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_sync_health_tenant_read ON public.school_sync_health;
CREATE POLICY school_sync_health_tenant_read ON public.school_sync_health
  FOR SELECT TO authenticated
  USING (child_id = ANY (public.current_child_ids()));
-- No client write policies: pull scripts write via service_role (telemetry/health.py).

GRANT SELECT ON public.school_sync_health TO authenticated;

-- Recompute freshness for one child's rows (status dashboard calls this
-- before rendering so 'stale' flips without waiting for the next sync).
CREATE OR REPLACE FUNCTION public.recompute_school_sync_health(p_child_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_updated int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.child_access ca
                 WHERE ca.user_id = auth.uid() AND ca.child_id = p_child_id) THEN
    RAISE EXCEPTION 'no access to that child' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.school_sync_health h
  SET data_freshness_status = CASE
        WHEN h.error_text IS NOT NULL
             AND (h.last_success_at IS NULL OR h.last_run_finished >= h.last_success_at)
          THEN 'error'
        WHEN h.last_success_at IS NULL
          THEN 'never'
        WHEN now() - h.last_success_at > h.expected_freshness
          THEN 'stale'
        ELSE 'fresh'
      END,
      updated_at = now()
  WHERE h.child_id = p_child_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;
REVOKE ALL ON FUNCTION public.recompute_school_sync_health(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_school_sync_health(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. school_sync_runs: append-only per-run log (dashboard history + debugging).
--    Retention: 90 days (purge_old_school_sync_runs()).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_sync_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  source_name   text NOT NULL,
  machine       text NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  rows_pulled   int NOT NULL DEFAULT 0,
  rows_by_table jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_text    text,
  success       boolean,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_sync_runs_child_source_idx
  ON public.school_sync_runs (child_id, source_name, started_at DESC);

ALTER TABLE public.school_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_sync_runs_tenant_read ON public.school_sync_runs;
CREATE POLICY school_sync_runs_tenant_read ON public.school_sync_runs
  FOR SELECT TO authenticated
  USING (child_id = ANY (public.current_child_ids()));
-- No client write policies: pull scripts write via service_role only.

GRANT SELECT ON public.school_sync_runs TO authenticated;

-- 90-day retention for the per-run log.
CREATE OR REPLACE FUNCTION public.purge_old_school_sync_runs()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deleted bigint;
BEGIN
  DELETE FROM public.school_sync_runs
  WHERE started_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_old_school_sync_runs() FROM PUBLIC;
