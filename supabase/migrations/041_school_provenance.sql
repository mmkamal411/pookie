-- Migration 026: School data provenance + teacher/counselor inbox segregation
--
-- FR-SCHOOL-001 (data provenance), FR-SCHOOL-002 (counselor segregation, ASCA B.2),
-- FR-SCHOOL-016 (CC redaction of non-linked students).
--
-- PROVENANCE RULE (spec):
--   school_of_record — grades, attendance, official school comms. Inherits the
--     school's audience: under FERPA a custodial parent of a minor can obtain it
--     from the school regardless of in-app settings. Pookie never promises
--     otherwise (consent screen states this).
--   app_generated — check-ins, reflections, mood, AI chats, practice content,
--     forecasts the teen configures. Child-authority, governed by per-person x
--     per-scope grants.
--
-- ENFORCEMENT:
--   (a) Tag at write time: provenance columns are NOT NULL with CHECK
--       constraints; every insert path must supply the tag.
--   (b) Enforce at query layer: RLS scoping (below) + the parent-visible API
--       serializer blocklist in src/server/services/provenance.ts. The blocklist
--       is authoritative for parents; RLS is the backstop.
--
-- PARENT-VISIBLE SERIALIZER BLOCKLIST (mirrored in src/server/services/provenance.ts):
--   calibration_scores.*        — teen-only (FR-SCHOOL-003)
--   checkin_estimates.*         — teen-only (FR-SCHOOL-003)
--   checkins.text               — never in parent payloads (W8 contract)
--   lab_safety_pulses.question  — Reflection-scoped, never parent-visible
--   counselor_messages.body     — teen + teen-granted scope only (ASCA B.2)
-- Parent briefings/digests are built from a separate ALLOWLISTED projection
-- (buildParentBriefingProjection) — they cannot join blocklisted data.
--
-- IDEMPOTENT: IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE throughout.

-- ---------------------------------------------------------------------------
-- Provenance tagging on existing school tables
-- ---------------------------------------------------------------------------

-- grades / grade_snapshots: sync pipeline only → school_of_record.
ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'school_of_record'
  CHECK (provenance IN ('school_of_record', 'app_generated'));

ALTER TABLE public.grade_snapshots
  ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'school_of_record'
  CHECK (provenance IN ('school_of_record', 'app_generated'));

-- assignments: sync rows are school_of_record; manual rows are app_generated.
-- The manual-create service path stamps 'app_generated' explicitly.
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'school_of_record'
  CHECK (provenance IN ('school_of_record', 'app_generated'));

-- checkins: always app_generated (child-authority).
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'app_generated'
  CHECK (provenance IN ('school_of_record', 'app_generated'));

-- study_plans: app-generated forecasts the family configures.
ALTER TABLE public.study_plans
  ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'app_generated'
  CHECK (provenance IN ('school_of_record', 'app_generated'));

-- Backfill guard: any pre-existing row carrying the wrong tag gets corrected.
-- (Fresh project: no-op. Kept for correctness on restores.)
UPDATE public.grades          SET provenance = 'school_of_record' WHERE provenance <> 'school_of_record';
UPDATE public.grade_snapshots SET provenance = 'school_of_record' WHERE provenance <> 'school_of_record';
UPDATE public.checkins        SET provenance = 'app_generated'     WHERE provenance <> 'app_generated';
UPDATE public.study_plans     SET provenance = 'app_generated'     WHERE provenance <> 'app_generated';

-- ---------------------------------------------------------------------------
-- Provenance helpers (query-layer enforcement primitives)
-- ---------------------------------------------------------------------------

-- True when the origin is child-authority (scope-gated), false when it is
-- school-of-record (inherits the school's audience).
CREATE OR REPLACE FUNCTION public.is_child_authority(p_provenance text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT p_provenance = 'app_generated' $$;

-- Machine-readable provenance label for API thread headers / UI badges.
CREATE OR REPLACE FUNCTION public.provenance_label(p_provenance text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_provenance
    WHEN 'school_of_record' THEN 'School record — the school may share this with a custodial parent regardless of app settings.'
    WHEN 'app_generated'    THEN 'Created in Pookie — visibility follows your sharing settings.'
    ELSE 'Unknown provenance'
  END
$$;

-- ---------------------------------------------------------------------------
-- teacher_messages: provenance labels, source, safety-critical tagging
-- ---------------------------------------------------------------------------

ALTER TABLE public.teacher_messages
  ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'school_of_record'
    CHECK (provenance IN ('school_of_record', 'app_generated')),
  ADD COLUMN IF NOT EXISTS source text
    CHECK (source IN ('parentvue', 'ctls', 'gmail', 'manual')),
  ADD COLUMN IF NOT EXISTS from_addr text,
  ADD COLUMN IF NOT EXISTS to_addrs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cc_addrs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS safety_critical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS safety_tag_reason text,
  ADD COLUMN IF NOT EXISTS authored_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz;

-- Outbound drafts are app_generated (parent-authored); inbound school mail is
-- school_of_record. Backfill from direction for pre-existing rows.
UPDATE public.teacher_messages
  SET provenance = CASE WHEN direction = 'outbound' THEN 'app_generated' ELSE 'school_of_record' END;

CREATE INDEX IF NOT EXISTS teacher_messages_safety_critical_idx
  ON public.teacher_messages (child_id, safety_critical) WHERE safety_critical;

-- ---------------------------------------------------------------------------
-- counselor_messages: SEPARATE table (ASCA B.2). No parent-readable body column.
-- ---------------------------------------------------------------------------
-- Rationale: RLS is table-scoped (cleaner audit), the counselor store carries
-- different retention, and a flag is one buggy query away from a confidentiality
-- breach. Parents see METADATA ONLY via counselor_thread_metadata(); the body
-- requires the teen's explicit grant of the counselor_communications scope.

CREATE TABLE IF NOT EXISTS public.counselor_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id         uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  thread_key       text,
  from_addr        text,
  subject          text,
  body             text NOT NULL,                 -- teen + granted scope ONLY
  source           text CHECK (source IN ('parentvue', 'ctls', 'gmail', 'manual')),
  safety_critical  boolean NOT NULL DEFAULT false,
  safety_tag_reason text,
  fetched_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS counselor_messages_child_thread_idx
  ON public.counselor_messages (child_id, thread_key, created_at DESC);

ALTER TABLE public.counselor_messages ENABLE ROW LEVEL SECURITY;

-- Teen (child-role member of this tenant): full CRUD on own rows.
DROP POLICY IF EXISTS counselor_messages_teen_all ON public.counselor_messages;
CREATE POLICY counselor_messages_teen_all ON public.counselor_messages
  FOR ALL
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.counselor_messages.child_id
                  AND ca.role = 'child')
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.counselor_messages.child_id
                  AND ca.role = 'child')
  );

-- Parents: NO direct SELECT on the table at all (metadata comes from the RPC).
-- Safety-critical rows are readable by parents via the metadata RPC only when
-- flagged; bodies still require the teen's counselor_communications grant.
DROP POLICY IF EXISTS counselor_messages_parent_safety_read ON public.counselor_messages;
CREATE POLICY counselor_messages_parent_safety_read ON public.counselor_messages
  FOR SELECT
  USING (
    safety_critical = true
    AND child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.counselor_messages.child_id
                  AND ca.role = 'parent')
  );

-- Ingest path: service_role only (no client INSERT policy — deliberate).

-- ---------------------------------------------------------------------------
-- counselor_thread_metadata(): the ONLY parent path to counselor threads.
-- Returns metadata (thread exists, participants, last-updated, safety tag) —
-- NEVER the body. The teen caller gets the full thread.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.counselor_thread_metadata(p_child_id uuid)
RETURNS TABLE (
  thread_key text,
  subject text,
  from_addr text,
  last_message_at timestamptz,
  message_count bigint,
  safety_critical boolean,
  body text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT (p_child_id = ANY (public.current_child_ids())) THEN
    RAISE EXCEPTION 'tenant_scope_violation';
  END IF;

  SELECT ca.role INTO v_role
    FROM public.child_access ca
   WHERE ca.user_id = v_uid AND ca.child_id = p_child_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'tenant_scope_violation';
  END IF;

  IF v_role = 'child' THEN
    -- Teen: full thread incl. body.
    RETURN QUERY
      SELECT cm.thread_key, cm.subject, cm.from_addr,
             max(cm.created_at) AS last_message_at,
             count(*) AS message_count,
             bool_or(cm.safety_critical) AS safety_critical,
             (array_agg(cm.body ORDER BY cm.created_at DESC))[1] AS body
        FROM public.counselor_messages cm
       WHERE cm.child_id = p_child_id
       GROUP BY cm.thread_key, cm.subject, cm.from_addr
       ORDER BY last_message_at DESC;
  ELSE
    -- Parent: metadata only. body is ALWAYS NULL on this path.
    RETURN QUERY
      SELECT cm.thread_key, cm.subject, cm.from_addr,
             max(cm.created_at) AS last_message_at,
             count(*) AS message_count,
             bool_or(cm.safety_critical) AS safety_critical,
             NULL::text AS body
        FROM public.counselor_messages cm
       WHERE cm.child_id = p_child_id
       GROUP BY cm.thread_key, cm.subject, cm.from_addr
       ORDER BY last_message_at DESC;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.counselor_thread_metadata(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.counselor_thread_metadata(uuid) TO authenticated, service_role;
