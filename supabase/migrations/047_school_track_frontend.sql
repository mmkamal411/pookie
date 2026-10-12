-- Migration 047: School track frontend contracts (Squad 3, 2026-10-12)
-- (Renumbered by the migration coordinator; was drafted as 024.)
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
-- ---------------------------------------------------------------------------
-- 1. Check-in estimates (FR-SCHOOL-003): the teen's near-term outcome guesses.
--    Paired with actuals when sync data arrives; drives the teen-only
--    calibration display. Never parent-visible (RLS + service blocklist).
--
--    The table itself is created in 042_checkin_calibration.sql (rich schema:
--    child_id, kind, estimate_date, description, error_pct generated, teen-only
--    RLS). This section adds ONLY the `label` column the wired check-in
--    contract selects/inserts (CheckinEstimate.label in src/lib/school/types).
-- ---------------------------------------------------------------------------
ALTER TABLE public.checkin_estimates
  ADD COLUMN IF NOT EXISTS label text;

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
-- ---------------------------------------------------------------------------
-- 3. Study Sparks (FR-SCHOOL-004): renamed peer-tips surface. Provenance
--    label columns per sol-school-ai §3.2. 4-week TTL enforced at read time.
--
--    The table is created in 043_study_sparks.sql (full schema incl. `body`,
--    generated `ai_label`, qa/review tables, purge function). These ALTERs
--    are belt-and-suspenders for apply orders that skipped 043 — normally
--    no-ops.
-- ---------------------------------------------------------------------------
ALTER TABLE public.study_sparks ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.study_sparks ADD COLUMN IF NOT EXISTS ai_label text;

-- ---------------------------------------------------------------------------
-- 4. Second-parent claim flow (FR-AUTH-011, D5 open signup).
--
--    UNIFIED on 049_second_parent_claim.sql (parent_claims / parent_invites /
--    claim_notifications / claim_attempts / claim_lockouts + SECURITY DEFINER
--    RPCs: submit_parent_claim, decide_parent_claim, escalate_stale_claims,
--    create_parent_invite, redeem_parent_invite, preview_parent_invite).
--    The RPC-guarded design (uniform anti-oracle responses, in-DB rate
--    limits, 30-day lockouts, atomic single-use redeem, hashed invite codes)
--    supersedes the family_claims/family_invites draft once sketched here —
--    those tables are NOT created (single claim truth, no schema fork).
--    Service layer: src/server/services/family-links.ts delegates to the RPCs.
-- ---------------------------------------------------------------------------
-- Court-order restriction flag (FR-AUTH-011): when set, self-serve linking
-- UI is hidden entirely for that child; claims route to human review.
-- (Also added in 049; idempotent.)
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS court_order_restriction boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 5. RLS notes.
--
--    checkin_estimates / study_sparks RLS lives in 042/043 (teen-only and
--    tenant-read respectively, via safe_auth_uid()). No additional policies
--    are created here: RLS policies combine permissively (OR), so any extra
--    policy could only WEAKEN the guarantees — deliberately none.
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.checkin_estimates IS
  'FR-SCHOOL-003: teen outcome estimates for metacognition calibration. actual_pct paired by the sync worker (integration seam). Never parent-visible.';
COMMENT ON TABLE public.study_sparks IS
  'FR-SCHOOL-004: Study Sparks — labeled study-skill micro-content with provenance columns. Written by the pipeline; frontend reads non-expired rows only.';
