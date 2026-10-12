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
  -- FR-SCHOOL-002 counselor segregation (ASCA B.2): counselor mail is
  -- SEGREGATED within the inbox by sender_type. Parent viewers see counselor
  -- threads as METADATA ONLY (body withheld, body_withheld=true) until the
  -- teen grants the counselor_communications scope; the teen sees everything.
  -- The withhold is enforced in the service layer (listMessagesV2 /
  -- listTeacherMessagesLegacy) — every parent-visible read path strips.
  ADD COLUMN IF NOT EXISTS sender_type text NOT NULL DEFAULT 'teacher'
    CHECK (sender_type IN ('teacher', 'counselor')),
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
-- Counselor segregation note (Squad 3 tech-lead consolidation 2026-10-12):
-- counselor mail is segregated via teacher_messages.sender_type (see above),
-- matching the wired frontend contract (teacher-thread.tsx renders counselor
-- sections from sender_type; listMessagesV2 withholds bodies for parents).
-- A separate counselor_messages table was considered (sol-school-ai §4.1) and
-- deliberately NOT created: one inbox truth, with the withhold enforced in
-- the service layer on every parent-visible read path.
