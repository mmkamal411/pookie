-- Migration 009: W5 college prep — registry, list, deadlines, essays, recommenders, scores, transcript releases
-- Source: coordinator brief (docs/MODULE-ARCHITECTURE-BATCH2.md was never committed; see BUILD-LOG 2026-10-11)
--
-- Scoping: all per-child tables are child_id-scoped via public.current_child_ids() —
-- the standard tenant pattern. Reference tables (colleges, college_stats,
-- requirement_templates, college_aid_programs) are public registries:
-- anon/authenticated read, no client writes (seeded here; P2 Scorecard ETL
-- owns future stat refreshes).
--
-- Honesty rules (non-negotiable, enforced in schema):
--   * college_stats.as_of is NOT NULL and source is NOT NULL — every stat is
--     dated and cited; no undated selectivity numbers can exist.
--   * No fabricated stats are seeded: the 50-college seed carries names,
--     locations, region, and control only (public facts). Stat rows arrive
--     via the P2 system-scope ETL (public Class-P rows only).
--   * No diagnostic/dosing columns exist anywhere in this migration
--     (grep-verifiable: no diagnosis/dose/dosage/insulin/prescription columns).
-- Transcript releases: release_authorization_integrity CHECK mirrors 008's
-- dispute_approval_integrity (requested/approved/sent are IMPOSSIBLE without
-- the frozen authorized_text + authorized_by). Authority flips to the student
-- at 18 via the lazy-DOB helper release_authority_for() — the route checks it;
-- unknown DOB fails closed to parent authority.
-- Test scores are manual + upload-verified; report PDFs live in the private
-- 'test-score-reports' bucket (created below). There is deliberately NO
-- CollegeBoard/ACT scraping surface — encoded by absence.

-- ---------------------------------------------------------------------------
-- colleges: the 50-seed registry. GA in-state + Southeast regional +
-- national pre-med (founder-locked starting set). Public facts only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.colleges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  city       text NOT NULL,
  state      text NOT NULL,
  region     text NOT NULL CHECK (region IN ('ga_instate','southeast','national_premed')),
  control    text NOT NULL CHECK (control IN ('public','private')),
  website    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS colleges_public_read ON public.colleges;
CREATE POLICY colleges_public_read ON public.colleges
  FOR SELECT USING (true);

GRANT SELECT ON public.colleges TO anon, authenticated;

-- Seed: 50 colleges (names/locations are public facts; NO selectivity stats
-- are seeded — see college_stats below).
INSERT INTO public.colleges (name, city, state, region, control) VALUES
  -- GA in-state (15)
  ('Georgia Institute of Technology', 'Atlanta', 'GA', 'ga_instate', 'public'),
  ('University of Georgia', 'Athens', 'GA', 'ga_instate', 'public'),
  ('Emory University', 'Atlanta', 'GA', 'ga_instate', 'private'),
  ('Georgia State University', 'Atlanta', 'GA', 'ga_instate', 'public'),
  ('Mercer University', 'Macon', 'GA', 'ga_instate', 'private'),
  ('Georgia Southern University', 'Statesboro', 'GA', 'ga_instate', 'public'),
  ('Kennesaw State University', 'Kennesaw', 'GA', 'ga_instate', 'public'),
  ('Augusta University', 'Augusta', 'GA', 'ga_instate', 'public'),
  ('Georgia College & State University', 'Milledgeville', 'GA', 'ga_instate', 'public'),
  ('University of West Georgia', 'Carrollton', 'GA', 'ga_instate', 'public'),
  ('Valdosta State University', 'Valdosta', 'GA', 'ga_instate', 'public'),
  ('Columbus State University', 'Columbus', 'GA', 'ga_instate', 'public'),
  ('Georgia Gwinnett College', 'Lawrenceville', 'GA', 'ga_instate', 'public'),
  ('Clayton State University', 'Morrow', 'GA', 'ga_instate', 'public'),
  ('Dalton State College', 'Dalton', 'GA', 'ga_instate', 'public'),
  -- Southeast regional (20)
  ('Auburn University', 'Auburn', 'AL', 'southeast', 'public'),
  ('University of Alabama', 'Tuscaloosa', 'AL', 'southeast', 'public'),
  ('Clemson University', 'Clemson', 'SC', 'southeast', 'public'),
  ('University of South Carolina', 'Columbia', 'SC', 'southeast', 'public'),
  ('University of Florida', 'Gainesville', 'FL', 'southeast', 'public'),
  ('Florida State University', 'Tallahassee', 'FL', 'southeast', 'public'),
  ('University of Central Florida', 'Orlando', 'FL', 'southeast', 'public'),
  ('University of Tennessee, Knoxville', 'Knoxville', 'TN', 'southeast', 'public'),
  ('Vanderbilt University', 'Nashville', 'TN', 'southeast', 'private'),
  ('Duke University', 'Durham', 'NC', 'southeast', 'private'),
  ('University of North Carolina at Chapel Hill', 'Chapel Hill', 'NC', 'southeast', 'public'),
  ('North Carolina State University', 'Raleigh', 'NC', 'southeast', 'public'),
  ('Wake Forest University', 'Winston-Salem', 'NC', 'southeast', 'private'),
  ('University of Virginia', 'Charlottesville', 'VA', 'southeast', 'public'),
  ('Virginia Tech', 'Blacksburg', 'VA', 'southeast', 'public'),
  ('University of Kentucky', 'Lexington', 'KY', 'southeast', 'public'),
  ('Louisiana State University', 'Baton Rouge', 'LA', 'southeast', 'public'),
  ('University of Mississippi', 'Oxford', 'MS', 'southeast', 'public'),
  ('University of Arkansas', 'Fayetteville', 'AR', 'southeast', 'public'),
  ('College of Charleston', 'Charleston', 'SC', 'southeast', 'public'),
  -- National pre-med (15)
  ('Johns Hopkins University', 'Baltimore', 'MD', 'national_premed', 'private'),
  ('Harvard University', 'Cambridge', 'MA', 'national_premed', 'private'),
  ('Stanford University', 'Stanford', 'CA', 'national_premed', 'private'),
  ('Yale University', 'New Haven', 'CT', 'national_premed', 'private'),
  ('Princeton University', 'Princeton', 'NJ', 'national_premed', 'private'),
  ('Columbia University', 'New York', 'NY', 'national_premed', 'private'),
  ('University of Pennsylvania', 'Philadelphia', 'PA', 'national_premed', 'private'),
  ('Brown University', 'Providence', 'RI', 'national_premed', 'private'),
  ('Dartmouth College', 'Hanover', 'NH', 'national_premed', 'private'),
  ('Cornell University', 'Ithaca', 'NY', 'national_premed', 'private'),
  ('Northwestern University', 'Evanston', 'IL', 'national_premed', 'private'),
  ('Washington University in St. Louis', 'St. Louis', 'MO', 'national_premed', 'private'),
  ('Rice University', 'Houston', 'TX', 'national_premed', 'private'),
  ('Baylor University', 'Waco', 'TX', 'national_premed', 'private'),
  ('Boston University', 'Boston', 'MA', 'national_premed', 'private')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- college_stats: selectivity/academic stats. as_of + source are NOT NULL —
-- an undated or uncited stat cannot be stored, by schema. Populated by the
-- P2 Scorecard ETL (public Class-P rows only); NOTHING is seeded here.
-- stat_key examples: 'acceptance_rate', 'median_sat', 'median_act',
-- 'avg_gpa', 'enrollment_total'. Values are bands/points, never probabilities.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.college_stats (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  stat_key   text NOT NULL,
  stat_value numeric NOT NULL,
  as_of      date NOT NULL,                       -- honesty rule: every stat is dated
  source     text NOT NULL,                       -- honesty rule: every stat is cited
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (college_id, stat_key, as_of)
);

ALTER TABLE public.college_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS college_stats_public_read ON public.college_stats;
CREATE POLICY college_stats_public_read ON public.college_stats
  FOR SELECT USING (true);

GRANT SELECT ON public.college_stats TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- requirement_templates: per-college or generic application requirements.
-- college_id NULL = generic template (e.g. Common App essay).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.requirement_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE,                           -- natural key for idempotent seeds
  college_id  uuid REFERENCES public.colleges(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('essay','test','recommendation','transcript','portfolio','interview','other')),
  label       text NOT NULL,
  description text,
  required    boolean NOT NULL DEFAULT true,
  sort_order  smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.requirement_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS requirement_templates_public_read ON public.requirement_templates;
CREATE POLICY requirement_templates_public_read ON public.requirement_templates
  FOR SELECT USING (true);

GRANT SELECT ON public.requirement_templates TO anon, authenticated;

-- Seed: generic templates (apply to any college).
INSERT INTO public.requirement_templates (template_key, college_id, kind, label, description, required, sort_order) VALUES
  ('personal_statement', NULL, 'essay', 'Personal statement', 'Common App personal essay, 650 words max', true, 10),
  ('test_scores', NULL, 'test', 'SAT or ACT scores', 'Official scores sent from the testing agency', false, 20),
  ('teacher_rec', NULL, 'recommendation', 'Teacher recommendation', 'At least one core-subject teacher recommendation', true, 30),
  ('counselor_rec', NULL, 'recommendation', 'Counselor recommendation', 'School counselor recommendation + school report', true, 40),
  ('official_transcript', NULL, 'transcript', 'Official transcript', 'Released via an authorized transcript release', true, 50)
ON CONFLICT (template_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- college_aid_programs: state/federal aid programs. Seeded with Georgia's
-- HOPE Scholarship and Zell Miller Scholarship (founder-locked for the GA
-- starting set). as_of + source NOT NULL — program terms change yearly.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.college_aid_programs (
  program_key      text PRIMARY KEY,              -- e.g. 'hope', 'zell_miller'
  name             text NOT NULL,
  state            text NOT NULL,                 -- 'GA', 'US' (federal), ...
  description      text NOT NULL,
  min_gpa          numeric(3,2),
  test_requirement text,                           -- e.g. '1200 SAT or 26 ACT'
  residency        text,                           -- e.g. 'Georgia resident'
  as_of            date NOT NULL,
  source           text NOT NULL,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.college_aid_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS college_aid_programs_public_read ON public.college_aid_programs;
CREATE POLICY college_aid_programs_public_read ON public.college_aid_programs
  FOR SELECT USING (true);

GRANT SELECT ON public.college_aid_programs TO anon, authenticated;

INSERT INTO public.college_aid_programs
  (program_key, name, state, description, min_gpa, test_requirement, residency, as_of, source, active)
VALUES
  ('hope', 'HOPE Scholarship', 'GA',
   'Merit-based award for Georgia residents attending eligible GA colleges; covers a portion of tuition.',
   3.00, NULL, 'Georgia resident', '2026-10-11', 'gsfc.org', true),
  ('zell_miller', 'Zell Miller Scholarship', 'GA',
   'Top-tier merit award for Georgia residents; covers full standard tuition at eligible GA colleges.',
   3.70, '1200 SAT or 26 ACT (single sitting)', 'Georgia resident', '2026-10-11', 'gsfc.org', true)
ON CONFLICT (program_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- college_list: the child's working list. UNIQUE (child_id, college_id).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.college_list (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  college_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'interested'
             CHECK (status IN ('interested','applying','applied','accepted','denied','waitlisted','enrolled','removed')),
  notes      text,
  data_class text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, college_id)
);

CREATE INDEX IF NOT EXISTS college_list_child_status_idx
  ON public.college_list (child_id, status);

-- ---------------------------------------------------------------------------
-- deadlines: application + aid deadlines per child (college-scoped or general).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deadlines (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  college_id uuid REFERENCES public.colleges(id) ON DELETE SET NULL,
  kind       text NOT NULL CHECK (kind IN ('early_action','early_decision','early_decision_2','regular','rolling','scholarship','fafsa','css_profile','other')),
  label      text NOT NULL,
  due_at     timestamptz NOT NULL,
  notes      text,
  done       boolean NOT NULL DEFAULT false,
  data_class text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deadlines_child_due_idx
  ON public.deadlines (child_id, due_at) WHERE NOT done;

-- ---------------------------------------------------------------------------
-- essays: per-college (or general) essay drafts. status is a forward-only
-- workflow in the route; the schema keeps the states only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.essays (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  college_id uuid REFERENCES public.colleges(id) ON DELETE SET NULL,
  prompt     text NOT NULL,
  draft      text,
  status     text NOT NULL DEFAULT 'draft'
             CHECK (status IN ('draft','in_review','final')),
  word_limit smallint,
  data_class text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS essays_child_college_idx
  ON public.essays (child_id, college_id);

-- ---------------------------------------------------------------------------
-- recommenders: who was asked, what state the letter is in.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recommenders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  name           text NOT NULL,
  relationship   text NOT NULL CHECK (relationship IN ('teacher','counselor','coach','employer','other')),
  email          text,
  status         text NOT NULL DEFAULT 'asked'
                 CHECK (status IN ('asked','agreed','submitted','declined')),
  requested_at   timestamptz,
  submitted_at   timestamptz,
  data_class     text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recommenders_child_status_idx
  ON public.recommenders (child_id, status);

-- ---------------------------------------------------------------------------
-- test_scores: manual + upload-verified scores. section_scores holds the
-- per-section breakdown (e.g. {"math": 720, "reading_writing": 700});
-- total is the headline number. report_path points into the private
-- 'test-score-reports' bucket. verified flips only after a human (or the
-- upload-verification route) confirms the report matches.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_scores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  test           text NOT NULL CHECK (test IN ('SAT','ACT','PSAT','AP','other')),
  test_date      date,
  section_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  total          numeric(7,2),
  report_path    text,                            -- <child_id>/scores/<yyyy-mm-dd>/<file> in test-score-reports
  verified       boolean NOT NULL DEFAULT false,
  data_class     text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS test_scores_child_test_idx
  ON public.test_scores (child_id, test, test_date DESC);

-- ---------------------------------------------------------------------------
-- transcript_releases: per-college, per-document release authorizations.
-- release_authorization_integrity mirrors 008's dispute_approval_integrity:
-- requested/approved/sent are IMPOSSIBLE without the frozen authorized_text
-- + authorized_by. Authority flips to the student at 18 — see
-- release_authority_for() below (lazy DOB check, enforced in the route).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transcript_releases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  college_id     uuid REFERENCES public.colleges(id) ON DELETE SET NULL,
  document_kind  text NOT NULL DEFAULT 'official_transcript'
                 CHECK (document_kind IN ('official_transcript','midyear_report','final_transcript','other')),
  status         text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','requested','approved','sent','revoked')),
  authorized_text text,                            -- frozen snapshot of the exact authorization the signer approved
  authorized_by  uuid REFERENCES public.users(id),
  authorized_at  timestamptz,
  sent_at        timestamptz,
  data_class     text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transcript_releases_child_status_idx
  ON public.transcript_releases (child_id, status);

-- The bright line as a CHECK constraint (re-runnable: drop-then-add).
ALTER TABLE public.transcript_releases DROP CONSTRAINT IF EXISTS release_authorization_integrity;
ALTER TABLE public.transcript_releases
  ADD CONSTRAINT release_authorization_integrity
  CHECK (
    (status IN ('requested','approved','sent') AND authorized_text IS NOT NULL AND authorized_by IS NOT NULL)
    OR (status IN ('draft','revoked'))
  );

-- ---------------------------------------------------------------------------
-- RLS: tenant-scoped via current_child_ids(). SELECT by tenant members;
-- INSERT/UPDATE/DELETE by tenant members (routes add parent/child role
-- gating; the authorization CHECK above is the DB-level bright line for
-- releases regardless of who holds the pen).
-- ---------------------------------------------------------------------------
ALTER TABLE public.college_list       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadlines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essays            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommenders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_scores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS college_list_tenant_read ON public.college_list;
CREATE POLICY college_list_tenant_read ON public.college_list
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS college_list_tenant_write ON public.college_list;
CREATE POLICY college_list_tenant_write ON public.college_list
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS deadlines_tenant_read ON public.deadlines;
CREATE POLICY deadlines_tenant_read ON public.deadlines
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS deadlines_tenant_write ON public.deadlines;
CREATE POLICY deadlines_tenant_write ON public.deadlines
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS essays_tenant_read ON public.essays;
CREATE POLICY essays_tenant_read ON public.essays
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS essays_tenant_write ON public.essays;
CREATE POLICY essays_tenant_write ON public.essays
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS recommenders_tenant_read ON public.recommenders;
CREATE POLICY recommenders_tenant_read ON public.recommenders
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS recommenders_tenant_write ON public.recommenders;
CREATE POLICY recommenders_tenant_write ON public.recommenders
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS test_scores_tenant_read ON public.test_scores;
CREATE POLICY test_scores_tenant_read ON public.test_scores
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS test_scores_tenant_write ON public.test_scores;
CREATE POLICY test_scores_tenant_write ON public.test_scores
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS transcript_releases_tenant_read ON public.transcript_releases;
CREATE POLICY transcript_releases_tenant_read ON public.transcript_releases
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS transcript_releases_tenant_write ON public.transcript_releases;
CREATE POLICY transcript_releases_tenant_write ON public.transcript_releases
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));

-- ---------------------------------------------------------------------------
-- Explicit GRANTs (least privilege). No anon grants on tenant tables.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.college_list TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deadlines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.essays TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommenders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcript_releases TO authenticated;

-- ---------------------------------------------------------------------------
-- release_authority_for(p_child_id): who may authorize a transcript release.
-- 'student' once the child is 18 (lazy DOB check); 'parent' otherwise.
-- Unknown DOB fails closed to 'parent'. NULL child -> NULL (route treats as
-- parent-required). The release route MUST call this before stamping
-- authorized_by; the schema cannot cross-table CHECK it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_authority_for(p_child_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.date_of_birth IS NULL THEN 'parent'
    WHEN c.date_of_birth <= CURRENT_DATE - interval '18 years' THEN 'student'
    ELSE 'parent'
  END
  FROM public.children c
  WHERE c.id = p_child_id
$$;

REVOKE ALL ON FUNCTION public.release_authority_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_authority_for(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- simulate_gpa(p_child_id, p_term, p_adjustments): "what-if" GPA over the W1
-- grades table. p_adjustments = [{"class_id":"<uuid>","numeric":95}, ...]
-- overrides (or adds) class grades before averaging. Returns NULL when there
-- are no graded rows — "no data", never 0. The route renders bands ("on
-- track for HOPE" etc.) from this number; the number itself is a plain mean
-- of stored numeric grades, never a probability.
-- SECURITY DEFINER with an explicit tenant assert (it bypasses grades RLS).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.simulate_gpa(
  p_child_id    uuid,
  p_term        text DEFAULT NULL,
  p_adjustments jsonb DEFAULT '[]'::jsonb
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gpa numeric;
BEGIN
  IF p_child_id IS NULL OR NOT (p_child_id = ANY (public.current_child_ids())) THEN
    RAISE EXCEPTION 'tenant_membership_required';
  END IF;

  WITH base AS (
    SELECT g.class_id, g.numeric
    FROM public.grades g
    WHERE g.child_id = p_child_id
      AND (p_term IS NULL OR g.term = p_term)
      AND g.numeric IS NOT NULL
  ),
  adj AS (
    SELECT (a->>'class_id')::uuid AS class_id,
           (a->>'numeric')::numeric AS numeric
    FROM jsonb_array_elements(COALESCE(p_adjustments, '[]'::jsonb)) AS a
    WHERE (a ? 'class_id') AND (a ? 'numeric')
      AND (a->>'numeric')::numeric BETWEEN 0 AND 100
  ),
  merged AS (
    SELECT COALESCE(adj.class_id, base.class_id) AS class_id,
           COALESCE(adj.numeric, base.numeric)  AS numeric
    FROM base
    FULL OUTER JOIN adj ON adj.class_id = base.class_id
  )
  SELECT round(avg(m.numeric), 2) INTO v_gpa
  FROM merged m
  WHERE m.numeric IS NOT NULL;

  RETURN v_gpa;
END;
$$;

REVOKE ALL ON FUNCTION public.simulate_gpa(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.simulate_gpa(uuid, text, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage: private 'test-score-reports' bucket (test_scores.report_path).
-- Signed URLs minted server-side with short TTL; never public. v1 uploads go
-- through the POST route with service_role (admin client), so these storage
-- policies are defense-in-depth, not the primary path.
-- Path segment 1 = child_id: <child_id>/scores/<yyyy-mm-dd>/<file>
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('test-score-reports', 'test-score-reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS test_score_reports_tenant_select ON storage.objects;
CREATE POLICY test_score_reports_tenant_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'test-score-reports'
    AND ((storage.foldername(name))[1])::uuid = ANY (public.current_child_ids())
  );

DROP POLICY IF EXISTS test_score_reports_tenant_insert ON storage.objects;
CREATE POLICY test_score_reports_tenant_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'test-score-reports'
    AND ((storage.foldername(name))[1])::uuid = ANY (public.current_child_ids())
  );
