-- Migration 006: W1 school core — grades, assignments, study plans, teacher messages, check-ins
-- Source: docs/MODULE-ARCHITECTURE.md §1.1 (Data models for DBA)
--
-- Tenancy: every table is child_id-scoped via public.current_child_ids() —
-- the standard tenant pattern. No per-table audit triggers (route-level
-- audit_event() is the platform convention).
--
-- Write-path discipline (spec §1.1):
--   grades / grade_snapshots   — service_role sync pipeline ONLY (no client writes).
--   assignments                 — parents may manage manual rows; sync upserts via service_role.
--   study_plans                 — parent-role writes; child-role SELECT gated on safety_status='approved'
--                                 (fail-closed: unreviewed committee output never renders for a child).
--   teacher_messages            — parents draft/approve/send; inbound rows ingested via service_role.
--   checkins                    — any tenant member may INSERT/UPDATE (child writes own; parent may backfill).
-- Letters are never stored (spec §0.6): DB holds numeric only; letterGrade() is client-side.

-- ---------------------------------------------------------------------------
-- grades: current numeric grade per class per term (UNIQUE = idempotent upserts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.grades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id   uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  term       text NOT NULL,                       -- e.g. 'GP2', 'S1'
  numeric    numeric(5,2),                        -- NULL = ungraded this term
  source     text NOT NULL DEFAULT 'parentvue',   -- adapter key
  synced_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, class_id, term)
);

CREATE INDEX IF NOT EXISTS grades_child_class_idx ON public.grades (child_id, class_id);

-- ---------------------------------------------------------------------------
-- grade_snapshots: append-only grade history (feeds the ">3pt single-sync drop" trigger)
-- Retention: 13 months; archive/cleanup RPC later (spec §7 Q9).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.grade_snapshots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id   uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  term       text NOT NULL,
  numeric    numeric(5,2),
  taken_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grade_snapshots_child_class_taken_idx
  ON public.grade_snapshots (child_id, class_id, taken_at DESC);

-- ---------------------------------------------------------------------------
-- assignments: the due-next source.
-- UNIQUE (child_id, class_id, source_id): NULL source_id rows never collide
-- (Postgres NULL semantics), so manual rows stay insertable alongside sync rows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id        uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  source_id       text,                            -- adapter-stable id; NULL for manual rows
  title           text NOT NULL,
  category        text,                            -- matches keys in classes.grade_weights
  due_date        timestamptz,                     -- NULL = no due date
  status          text NOT NULL DEFAULT 'upcoming'
                  CHECK (status IN ('upcoming','submitted','graded','missing','late','excused')),
  points_earned   numeric(7,2),
  points_possible numeric(7,2),
  notes           text,
  synced_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, class_id, source_id)
);

CREATE INDEX IF NOT EXISTS assignments_child_due_idx
  ON public.assignments (child_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS assignments_child_class_attention_idx
  ON public.assignments (child_id, class_id) WHERE status IN ('missing','late');
CREATE INDEX IF NOT EXISTS assignments_class_id_idx
  ON public.assignments (class_id);

-- ---------------------------------------------------------------------------
-- due_next: view (not a table). security_invoker = true is REQUIRED —
-- without it the view runs as the owner and bypasses caller RLS (tenant leak).
-- Verify: \d+ public.due_next must show security_invoker.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.due_next WITH (security_invoker = true) AS
SELECT a.*
FROM public.assignments a
WHERE a.due_date IS NOT NULL
  AND a.status IN ('upcoming','missing','late')
  AND a.due_date >= now() - interval '1 day'
  AND a.due_date <= now() + interval '30 days';

-- ---------------------------------------------------------------------------
-- study_plans: persisted Path-to-90. Child-facing — carries the write-path
-- safety gate: child-role callers see ONLY safety_status='approved' rows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id      uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  week_start    date NOT NULL,
  plan          jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ranked actions: [{rank, action, why, done}]
  generated_by  text NOT NULL DEFAULT 'committee'
                CHECK (generated_by IN ('committee','parent','system')),
  safety_status text NOT NULL DEFAULT 'pending'
                CHECK (safety_status IN ('pending','approved','rejected')),
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','superseded','archived')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, class_id, week_start)
);

-- ---------------------------------------------------------------------------
-- teacher_messages: per-class inbox + outbound drafts with parent approval UX.
-- class_id NULL = counselor/general. Route rule (not just RLS):
-- draft -> approved -> sent transitions require parent role; the send route
-- re-checks assertParent and stamps approved_by = auth.uid().
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id    uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  direction   text NOT NULL CHECK (direction IN ('inbound','outbound')),
  subject     text,
  body        text NOT NULL,
  status      text NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','approved','sent','received')),
  approved_by uuid REFERENCES public.users(id),
  approved_at timestamptz,
  thread_key  text,                              -- groups a thread
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_messages_child_class_created_idx
  ON public.teacher_messages (child_id, class_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- checkins: daily check-in, 1 row/child/day.
-- Privacy contract (W8): raw text is child-confidential — the API list route
-- for parents returns aggregates (counts, averages), never raw text, unless
-- the child shared it or a safety tripwire fired. Enforced in the route.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  mood         smallint CHECK (mood BETWEEN 1 AND 5),
  energy       smallint CHECK (energy BETWEEN 1 AND 5),
  stress       smallint CHECK (stress BETWEEN 1 AND 5),
  text         text,                              -- child-private free text
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, checkin_date)
);

-- ---------------------------------------------------------------------------
-- RLS: all tables tenant-scoped via current_child_ids()
-- ---------------------------------------------------------------------------
ALTER TABLE public.grades            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins          ENABLE ROW LEVEL SECURITY;

-- grades / grade_snapshots: tenant read only. No client write policies —
-- writes are the sync pipeline via service_role with explicit child_id.
DROP POLICY IF EXISTS grades_tenant_read ON public.grades;
CREATE POLICY grades_tenant_read ON public.grades
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS grade_snapshots_tenant_read ON public.grade_snapshots;
CREATE POLICY grade_snapshots_tenant_read ON public.grade_snapshots
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

-- assignments: tenant read; parent-role write (manual tasks).
DROP POLICY IF EXISTS assignments_tenant_read ON public.assignments;
CREATE POLICY assignments_tenant_read ON public.assignments
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS assignments_parent_insert ON public.assignments;
CREATE POLICY assignments_parent_insert ON public.assignments
  FOR INSERT WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.assignments.child_id
                  AND ca.role = 'parent')
  );

DROP POLICY IF EXISTS assignments_parent_update ON public.assignments;
CREATE POLICY assignments_parent_update ON public.assignments
  FOR UPDATE
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.assignments.child_id
                  AND ca.role = 'parent')
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.assignments.child_id
                  AND ca.role = 'parent')
  );

DROP POLICY IF EXISTS assignments_parent_delete ON public.assignments;
CREATE POLICY assignments_parent_delete ON public.assignments
  FOR DELETE USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.assignments.child_id
                  AND ca.role = 'parent')
  );

-- study_plans read: tenant members see rows; child-role callers additionally
-- require safety_status='approved' — unreviewed committee output can never
-- render for the child even if the reviewer layer fails (fail closed).
-- Agent readers (no child_access row) take the NOT EXISTS arm — machine
-- readers see all rows, scoped by their job's tenant set.
DROP POLICY IF EXISTS study_plans_tenant_read ON public.study_plans;
CREATE POLICY study_plans_tenant_read ON public.study_plans
  FOR SELECT USING (
    child_id = ANY (public.current_child_ids())
    AND (
      safety_status = 'approved'
      OR NOT EXISTS (SELECT 1 FROM public.child_access ca
                     WHERE ca.user_id = auth.uid()
                       AND ca.child_id = public.study_plans.child_id
                       AND ca.role = 'child')
    )
  );

-- study_plans writes: parent-role only (committee writes via service_role).
DROP POLICY IF EXISTS study_plans_parent_insert ON public.study_plans;
CREATE POLICY study_plans_parent_insert ON public.study_plans
  FOR INSERT WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.study_plans.child_id
                  AND ca.role = 'parent')
  );

DROP POLICY IF EXISTS study_plans_parent_update ON public.study_plans;
CREATE POLICY study_plans_parent_update ON public.study_plans
  FOR UPDATE
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.study_plans.child_id
                  AND ca.role = 'parent')
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.study_plans.child_id
                  AND ca.role = 'parent')
  );

DROP POLICY IF EXISTS study_plans_parent_delete ON public.study_plans;
CREATE POLICY study_plans_parent_delete ON public.study_plans
  FOR DELETE USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.study_plans.child_id
                  AND ca.role = 'parent')
  );

-- teacher_messages: tenant read; parent-role write (draft/approve/send).
DROP POLICY IF EXISTS teacher_messages_tenant_read ON public.teacher_messages;
CREATE POLICY teacher_messages_tenant_read ON public.teacher_messages
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS teacher_messages_parent_insert ON public.teacher_messages;
CREATE POLICY teacher_messages_parent_insert ON public.teacher_messages
  FOR INSERT WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.teacher_messages.child_id
                  AND ca.role = 'parent')
  );

DROP POLICY IF EXISTS teacher_messages_parent_update ON public.teacher_messages;
CREATE POLICY teacher_messages_parent_update ON public.teacher_messages
  FOR UPDATE
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.teacher_messages.child_id
                  AND ca.role = 'parent')
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.teacher_messages.child_id
                  AND ca.role = 'parent')
  );

-- checkins: tenant read; INSERT/UPDATE by any tenant member for their own tenant rows.
DROP POLICY IF EXISTS checkins_tenant_read ON public.checkins;
CREATE POLICY checkins_tenant_read ON public.checkins
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS checkins_member_insert ON public.checkins;
CREATE POLICY checkins_member_insert ON public.checkins
  FOR INSERT WITH CHECK (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS checkins_member_update ON public.checkins;
CREATE POLICY checkins_member_update ON public.checkins
  FOR UPDATE
  USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));

-- ---------------------------------------------------------------------------
-- Explicit GRANTs (least privilege). RLS policies alone grant nothing.
-- No anon grants on W1 tables (sync pipeline is service_role-only).
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.grades TO authenticated;
GRANT SELECT ON public.grade_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.teacher_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.checkins TO authenticated;
GRANT SELECT ON public.due_next TO authenticated;
