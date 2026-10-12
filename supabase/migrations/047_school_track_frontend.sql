-- Migration 024: School track frontend contracts (Squad 3, 2026-10-12)
--
-- Covers FR-SCHOOL-001/002/003/004/007/019 and FR-AUTH-011 (D5 open-signup).
-- All statements are re-runnable (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
-- DROP POLICY IF EXISTS). This migration is WRITTEN but NOT YET APPLIED to the
-- Pookie Supabase project — the backend squad must apply it before the new
-- endpoints (calibration, sparks, family claims/invites) return live data.
-- Existing-table changes are additive only; nothing here alters current reads.
--
-- Integration seams for the tech lead:
--   1. checkin_estimates.actual_pct pairing — the sync worker fills actual_pct
--      when the graded outcome arrives (FR-SCHOOL-003 calibration).
--   2. study_sparks rows are written by the Study Sparks pipeline (FR-SCHOOL-004);
--      the frontend only reads non-expired rows.
--   3. family_claims 14-day unresponsive escalation + 30-day re-request lockout
--      are enforced in the service layer; human review happens in the dashboard.

-- ---------------------------------------------------------------------------
-- 1. Check-in estimates (FR-SCHOOL-003): the teen's near-term outcome guesses.
--    Paired with actuals when sync data arrives; drives the teen-only
--    calibration display. Never parent-visible (RLS + service blocklist).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkin_estimates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id   uuid NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  label        text NOT NULL,                       -- e.g. "Geometry quiz"
  estimate_pct numeric NOT NULL CHECK (estimate_pct BETWEEN 0 AND 100),
  actual_pct   numeric CHECK (actual_pct BETWEEN 0 AND 100),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkin_estimates_checkin_idx
  ON public.checkin_estimates (checkin_id, created_at DESC);

-- Lab-safety pulse (FR-SCHOOL-019): one-question day-of-lab check inside the
-- morning check-in + anonymous ask box. The free-text box is Reflection-scoped
-- (teen-private); the read-the-card checkbox is teen-visible only.
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS lab_read_safety_card boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lab_anonymous_question text;

-- ---------------------------------------------------------------------------
-- 2. Teacher-message provenance (FR-SCHOOL-001/002): per-message source
--    labels. Counselor segregation follows the EXISTING 006 route rule
--    (class_id NULL = counselor/general) + sender_type — no schema fork.
-- ---------------------------------------------------------------------------
ALTER TABLE public.teacher_messages
  ADD COLUMN IF NOT EXISTS sender_type text NOT NULL DEFAULT 'teacher'
    CHECK (sender_type IN ('teacher', 'counselor')),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('parentvue', 'ctls', 'gmail', 'manual')),
  ADD COLUMN IF NOT EXISTS safety_critical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3. Study Sparks (FR-SCHOOL-004): renamed peer-tips surface. Provenance
--    label columns per sol-school-ai §3.2. 4-week TTL enforced at read time.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_sparks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id          uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id          uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  body              text NOT NULL,
  origin            text NOT NULL DEFAULT 'ai-synthesis'
    CHECK (origin IN ('ai-synthesis', 'curriculum-extraction')),
  source_refs       jsonb NOT NULL DEFAULT '[]'::jsonb,
  deident_method    text NOT NULL DEFAULT 'curriculum-only'
    CHECK (deident_method IN ('aggregate-k5', 'curriculum-only')),
  study_skill_tags  text[] NOT NULL DEFAULT '{}',
  review_status     text NOT NULL DEFAULT 'auto'
    CHECK (review_status IN ('auto', 'human-approved', 'qa-sampled')),
  ai_label          text NOT NULL DEFAULT 'Made by Pookie AI',
  expires_at        timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS study_sparks_child_live_idx
  ON public.study_sparks (child_id, class_id, expires_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Second-parent claim flow (FR-AUTH-011, D5 open signup).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_claims (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claimant_user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  child_name           text NOT NULL,            -- full name as typed by claimant
  child_dob            date NOT NULL,
  creating_parent_email text NOT NULL,
  perjury_attested     boolean NOT NULL DEFAULT false,
  custody_disclosed    boolean NOT NULL DEFAULT false,
  custody_details      text,
  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'human_review')),
  matched_child_id     uuid REFERENCES public.children(id) ON DELETE SET NULL,
  approver             text CHECK (approver IN ('parent_a', 'teen')),
  decided_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS family_claims_claimant_created_idx
  ON public.family_claims (claimant_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS family_claims_matched_status_idx
  ON public.family_claims (matched_child_id, status);

-- Invite-from-inside: Parent A generates a deep link/QR for Parent B.
CREATE TABLE IF NOT EXISTS public.family_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,               -- unguessable; shown once
  role        text NOT NULL DEFAULT 'parent' CHECK (role = 'parent'),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  used_by     uuid REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS family_invites_child_idx
  ON public.family_invites (child_id, created_at DESC);

-- Court-order restriction flag (FR-AUTH-011): when set, self-serve linking
-- UI is hidden entirely for that child; claims route to human review.
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS court_order_restriction boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 5. RLS: tenant-scoped via current_child_ids(); claims are claimant-owned.
-- ---------------------------------------------------------------------------
ALTER TABLE public.checkin_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sparks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_claims      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invites     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkin_estimates_tenant ON public.checkin_estimates;
CREATE POLICY checkin_estimates_tenant ON public.checkin_estimates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.checkins c
      WHERE c.id = checkin_estimates.checkin_id
        AND c.child_id = ANY (public.current_child_ids())
    )
  );

DROP POLICY IF EXISTS study_sparks_tenant ON public.study_sparks;
CREATE POLICY study_sparks_tenant ON public.study_sparks
  FOR ALL USING (study_sparks.child_id = ANY (public.current_child_ids()));

-- Claimants manage their own claims; approvals run through SECURITY DEFINER
-- service functions, never direct UPDATE from another user.
DROP POLICY IF EXISTS family_claims_claimant ON public.family_claims;
CREATE POLICY family_claims_claimant ON public.family_claims
  FOR ALL USING (family_claims.claimant_user_id = auth.uid())
  WITH CHECK (family_claims.claimant_user_id = auth.uid());

DROP POLICY IF EXISTS family_invites_tenant ON public.family_invites;
CREATE POLICY family_invites_tenant ON public.family_invites
  FOR ALL USING (family_invites.child_id = ANY (public.current_child_ids()));

COMMENT ON TABLE public.checkin_estimates IS
  'FR-SCHOOL-003: teen outcome estimates for metacognition calibration. actual_pct paired by the sync worker (integration seam). Never parent-visible.';
COMMENT ON TABLE public.study_sparks IS
  'FR-SCHOOL-004: Study Sparks — labeled study-skill micro-content with provenance columns. Written by the pipeline; frontend reads non-expired rows only.';
COMMENT ON TABLE public.family_claims IS
  'FR-AUTH-011 (D5 open signup): second-parent claim flow. Uniform responses to claimants; no enumeration. decided via Parent A (<13) or teen (13+).';
COMMENT ON TABLE public.family_invites IS
  'FR-AUTH-011: invite-from-inside deep links for second parents. Unguessable single-use tokens, 7-day TTL.';
