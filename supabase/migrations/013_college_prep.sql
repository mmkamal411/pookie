-- Migration 013: W5 college prep pipeline ("Will my child get into a good college?")
--
-- STATUS: authored for DBA + Security Engineer review — not yet applied to any live DB.
--
-- Numbering note: 009 is taken by 009_sync_queue.sql; the DBA's claimed
-- 010/011/012 (school_minutiae / health_tracker / nutrition_tracker) were never
-- delivered, so W5 takes 013 to avoid any filename collision. W16/W22/W23 keep
-- their claimed numbers. Apply order vs 010-012 is irrelevant (no dependency).
--
-- Depends on: 001 (children, child_access, current_child_ids, audit_log),
--             002 (classes), 006 (grades, grade_snapshots).
--
-- Honesty architecture (non-negotiable, from AI-MOTHER-VISION.md W5):
--   * Selectivity shown as 25th-75th percentile BANDS — never point probabilities.
--   * Every stat carries an as-of date + source (stats_as_of / stats_source).
--   * No "guarantee" language anywhere (enforced by scripts/copy-lint-college.sh).
--   * College Scorecard/IPEDS data is a STATIC v1 seed here; a live P2 ETL may
--     refresh the public `colleges` rows later (Class-P carve-out, documented).
--   * NO CollegeBoard/ACT integration exists — test scores are manual entry +
--     report upload with human verification. Scraping is rejected by design.
--   * Transcripts: the school sends; we orchestrate. Parent authorizes each
--     release per-college/per-document for minors; authority flips to the
--     student at 18 (route-enforced via children.date_of_birth); every release
--     is audit-logged (disclosure accounting). The release_authorization_integrity
--     CHECK below mirrors the 008 dispute_approval_integrity pattern.
--
-- Conventions follow 001_tenancy_core / 006-008: CREATE IF NOT EXISTS,
-- DROP POLICY IF EXISTS, explicit least-privilege GRANTs, SECURITY DEFINER +
-- SET search_path = public + REVOKE ALL FROM PUBLIC on functions, RLS on every
-- table, no client DELETE on the ledger-like transcript_releases.

-- ---------------------------------------------------------------------------
-- colleges: public reference directory (Class P). No child_id — one shared
-- directory, seeded once, refreshed only by a privileged ETL. Clients read;
-- nobody writes (service_role only).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.colleges (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL UNIQUE,
  city             text NOT NULL,
  state            text NOT NULL,                       -- 2-letter
  region           text NOT NULL CHECK (region IN ('ga_in_state','southeast','national')),
  control          text NOT NULL CHECK (control IN ('public','private')),
  selectivity      text NOT NULL CHECK (selectivity IN
                     ('most_selective','very_selective','selective',
                      'moderately_selective','inclusive')),
  sat_total_25     int CHECK (sat_total_25 BETWEEN 400 AND 1600),
  sat_total_75     int CHECK (sat_total_75 BETWEEN 400 AND 1600),
  act_25           int CHECK (act_25 BETWEEN 1 AND 36),
  act_75           int CHECK (act_75 BETWEEN 1 AND 36),
  acceptance_rate_pct numeric(4,1) CHECK (acceptance_rate_pct BETWEEN 0 AND 100),
  undergrad_enrollment int,
  common_app       boolean NOT NULL DEFAULT true,
  url              text,
  pre_med_note     text,                                -- why it's on the pre-med list
  stats_as_of      date NOT NULL,                       -- honesty: every stat dated
  stats_source     text NOT NULL,                       -- honesty: every stat cited
  data_class       text NOT NULL DEFAULT 'P',
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (sat_total_25 IS NULL OR sat_total_75 IS NULL OR sat_total_25 <= sat_total_75),
  CHECK (act_25 IS NULL OR act_75 IS NULL OR act_25 <= act_75)
);

CREATE INDEX IF NOT EXISTS colleges_region_idx ON public.colleges (region);
CREATE INDEX IF NOT EXISTS colleges_selectivity_idx ON public.colleges (selectivity);
CREATE INDEX IF NOT EXISTS colleges_name_lower_idx ON public.colleges (lower(name));

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS colleges_public_read ON public.colleges;
CREATE POLICY colleges_public_read ON public.colleges
  FOR SELECT USING (true);                              -- Class-P reference data
-- No INSERT/UPDATE/DELETE policies: client writes impossible; seed + ETL via service_role.
GRANT SELECT ON public.colleges TO authenticated;

-- ---------------------------------------------------------------------------
-- college_list: the child's list (child_id-scoped, Class T)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.college_list (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  college_id    uuid NOT NULL REFERENCES public.colleges(id) ON DELETE RESTRICT,
  status        text NOT NULL DEFAULT 'considering'
                  CHECK (status IN ('considering','applying','applied','deferred',
                                    'waitlisted','accepted','denied','enrolled','withdrawn')),
  interest_rank int CHECK (interest_rank BETWEEN 1 AND 3),  -- 1 = top choice
  notes         text,
  data_class    text NOT NULL DEFAULT 'T',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, college_id)
);
CREATE INDEX IF NOT EXISTS college_list_child_idx ON public.college_list (child_id);

ALTER TABLE public.college_list ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS college_list_tenant_all ON public.college_list;
CREATE POLICY college_list_tenant_all ON public.college_list
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.college_list TO authenticated;

-- ---------------------------------------------------------------------------
-- college_deadlines: per-college deadlines. Reminder buckets (30/14/7/2 days)
-- are DERIVED at read time (API/UI) — never stored, never drift.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.college_deadlines (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  college_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('application_early_decision','application_early_action',
                                           'application_regular','scholarship','financial_aid_fafsa',
                                           'financial_aid_css','housing','deposit','other')),
  label      text NOT NULL,
  due_at     timestamptz NOT NULL,
  completed  boolean NOT NULL DEFAULT false,
  notes      text,
  data_class text NOT NULL DEFAULT 'T',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS college_deadlines_child_due_idx
  ON public.college_deadlines (child_id, due_at);

ALTER TABLE public.college_deadlines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS college_deadlines_tenant_all ON public.college_deadlines;
CREATE POLICY college_deadlines_tenant_all ON public.college_deadlines
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.college_deadlines TO authenticated;

-- ---------------------------------------------------------------------------
-- college_requirements: per-list-entry application checklist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.college_requirements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  list_id     uuid NOT NULL REFERENCES public.college_list(id) ON DELETE CASCADE,
  requirement text NOT NULL CHECK (requirement IN ('transcript','test_scores','essay',
                    'recommendation','portfolio','interview','application_fee','other')),
  label       text NOT NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','waived')),
  notes       text,
  data_class  text NOT NULL DEFAULT 'T',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, requirement, label)
);
CREATE INDEX IF NOT EXISTS college_requirements_child_idx
  ON public.college_requirements (child_id);

ALTER TABLE public.college_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS college_requirements_tenant_all ON public.college_requirements;
CREATE POLICY college_requirements_tenant_all ON public.college_requirements
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.college_requirements TO authenticated;

-- ---------------------------------------------------------------------------
-- college_essays: per-college essay workspace. ai_feedback is written ONLY by
-- the feedback route (tenant-partitioned); the AI call site itself is a stub
-- (src/server/essay-feedback.ts) — no provider is called, nothing trains.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.college_essays (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id           uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  college_id         uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  prompt             text NOT NULL,
  draft              text NOT NULL DEFAULT '',
  word_target        int CHECK (word_target BETWEEN 1 AND 5000),
  status             text NOT NULL DEFAULT 'not_started'
                       CHECK (status IN ('not_started','drafting','revising','final')),
  ai_feedback        jsonb,
  ai_feedback_status text NOT NULL DEFAULT 'none'
                       CHECK (ai_feedback_status IN ('none','pending','ready','failed')),
  ai_feedback_at     timestamptz,
  data_class         text NOT NULL DEFAULT 'T',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS college_essays_child_idx ON public.college_essays (child_id);

ALTER TABLE public.college_essays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS college_essays_tenant_all ON public.college_essays;
CREATE POLICY college_essays_tenant_all ON public.college_essays
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.college_essays TO authenticated;

-- ---------------------------------------------------------------------------
-- college_recommenders + recommender_assignments (per-college tracking)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.college_recommenders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  name       text NOT NULL,
  role       text NOT NULL CHECK (role IN ('teacher','counselor','coach','employer','mentor','other')),
  email      text,
  subject    text,
  status     text NOT NULL DEFAULT 'to_ask'
               CHECK (status IN ('to_ask','asked','agreed','submitted','declined')),
  notes      text,
  data_class text NOT NULL DEFAULT 'T',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS college_recommenders_child_idx
  ON public.college_recommenders (child_id);

ALTER TABLE public.college_recommenders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS college_recommenders_tenant_all ON public.college_recommenders;
CREATE POLICY college_recommenders_tenant_all ON public.college_recommenders
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.college_recommenders TO authenticated;

CREATE TABLE IF NOT EXISTS public.recommender_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  recommender_id uuid NOT NULL REFERENCES public.college_recommenders(id) ON DELETE CASCADE,
  list_id        uuid NOT NULL REFERENCES public.college_list(id) ON DELETE CASCADE,
  due_at         timestamptz,
  status         text NOT NULL DEFAULT 'requested'
                   CHECK (status IN ('requested','submitted','waived')),
  notes          text,
  data_class     text NOT NULL DEFAULT 'T',
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recommender_id, list_id)
);
CREATE INDEX IF NOT EXISTS recommender_assignments_child_idx
  ON public.recommender_assignments (child_id);

ALTER TABLE public.recommender_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recommender_assignments_tenant_all ON public.recommender_assignments;
CREATE POLICY recommender_assignments_tenant_all ON public.recommender_assignments
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommender_assignments TO authenticated;

-- ---------------------------------------------------------------------------
-- college_test_scores: manual entry + report upload. verified is set ONLY by
-- the parent verify route (human compares "you entered X / report says Y").
-- There is NO CollegeBoard/ACT integration — by design, not by omission.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.college_test_scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  test_type     text NOT NULL CHECK (test_type IN ('SAT','ACT','PSAT','AP','other')),
  taken_at      date,
  sections      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- e.g. {"ebrw":720,"math":740}
  total         int,
  report_path   text,                                 -- storage: test-score-reports/…
  verified      boolean NOT NULL DEFAULT false,
  verified_by   uuid,
  verified_at   timestamptz,
  verified_note text,                                 -- "entered 1450 / report 1450 — match"
  notes         text,
  data_class    text NOT NULL DEFAULT 'T',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS college_test_scores_child_idx
  ON public.college_test_scores (child_id);

ALTER TABLE public.college_test_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS college_test_scores_tenant_all ON public.college_test_scores;
CREATE POLICY college_test_scores_tenant_all ON public.college_test_scores
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.college_test_scores TO authenticated;

-- Private bucket for score-report uploads (mirrors the 008 mail-photos pattern).
-- Path: <uploader_uid>/test-scores/<child_id>/<filename>. v1 uploads go through
-- the API route (service_role); the storage policies below are defense-in-depth.
INSERT INTO storage.buckets (id, name, public)
VALUES ('test-score-reports', 'test-score-reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS test_score_reports_owner_select ON storage.objects;
CREATE POLICY test_score_reports_owner_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'test-score-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
DROP POLICY IF EXISTS test_score_reports_owner_insert ON storage.objects;
CREATE POLICY test_score_reports_owner_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'test-score-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- transcript_releases: disclosure accounting. Ledger-like: NO client DELETE.
-- Authorization is explicit per-college/per-document; the CHECK makes
-- authorized/sent/acknowledged impossible without a stamped authorizer.
-- Authority flips to the student at 18 — enforced in the authorize route via
-- children.date_of_birth (lazy DOB check); the DB guarantees the stamp.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transcript_releases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  college_id     uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  document       text NOT NULL CHECK (document IN ('transcript','school_report',
                       'counselor_recommendation','midyear_report','final_report')),
  status         text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','authorized','sent','acknowledged')),
  authorized_by  uuid,
  authorized_at  timestamptz,
  authorizer_role text CHECK (authorizer_role IN ('parent','student')),
  sent_at        timestamptz,
  sent_method    text,                                 -- e.g. 'parchment','counselor_email','hand'
  notes          text,
  data_class     text NOT NULL DEFAULT 'T',
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT release_authorization_integrity CHECK (
    status = 'draft'
    OR (authorized_by IS NOT NULL AND authorized_at IS NOT NULL
        AND authorizer_role IS NOT NULL)
  ),
  UNIQUE (child_id, college_id, document)
);
CREATE INDEX IF NOT EXISTS transcript_releases_child_idx
  ON public.transcript_releases (child_id);

ALTER TABLE public.transcript_releases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transcript_releases_tenant_read ON public.transcript_releases;
CREATE POLICY transcript_releases_tenant_read ON public.transcript_releases
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));
DROP POLICY IF EXISTS transcript_releases_tenant_write ON public.transcript_releases;
CREATE POLICY transcript_releases_tenant_write ON public.transcript_releases
  FOR INSERT WITH CHECK (child_id = ANY (public.current_child_ids()));
DROP POLICY IF EXISTS transcript_releases_tenant_update ON public.transcript_releases;
CREATE POLICY transcript_releases_tenant_update ON public.transcript_releases
  FOR UPDATE USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));
-- No DELETE policy/grant: releases are disclosure accounting (ledger-like).
GRANT SELECT, INSERT, UPDATE ON public.transcript_releases TO authenticated;

-- ---------------------------------------------------------------------------
-- simulate_gpa(p_child_id, p_term, p_hypotheticals): "what does my GPA look
-- like if…" Reads W1 grades (006) — trend > snapshot. Hypotheticals override
-- per-class numerics WITHOUT writing anything (pure read + math).
--
-- p_hypotheticals: jsonb array of {"class_id": uuid, "numeric": number|null}
-- Returns jsonb: { term, current_gpa, simulated_gpa, delta, class_count,
--                  classes: [{class_id, name, current, hypothetical, counts}],
--                  trend: {first_avg, last_avg, delta, direction} | null }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.simulate_gpa(
  p_child_id uuid,
  p_term text DEFAULT NULL,
  p_hypotheticals jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term        text;
  v_hyp         jsonb := COALESCE(p_hypotheticals, '[]'::jsonb);
  v_cur_sum     numeric := 0; v_cur_n int := 0;
  v_sim_sum     numeric := 0; v_sim_n int := 0;
  v_classes     jsonb := '[]'::jsonb;
  v_trend       jsonb := NULL;
  r             record;
  v_hyp_val     numeric;
  v_eff         numeric;
  v_first_avg   numeric; v_last_avg numeric;
BEGIN
  IF NOT (p_child_id = ANY (public.current_child_ids())) THEN
    RAISE EXCEPTION 'tenant_membership_required';
  END IF;

  -- Resolve term: explicit > latest graded term > error-free NULL.
  v_term := p_term;
  IF v_term IS NULL THEN
    SELECT g.term INTO v_term
    FROM public.grades g
    WHERE g.child_id = p_child_id AND g.numeric IS NOT NULL
    ORDER BY g.synced_at DESC LIMIT 1;
  END IF;

  FOR r IN
    SELECT c.id AS class_id, c.display_name, c.name, g.numeric AS current_numeric
    FROM public.classes c
    LEFT JOIN public.grades g
      ON g.class_id = c.id AND g.child_id = p_child_id
     AND (v_term IS NULL OR g.term = v_term)
    WHERE c.child_id = p_child_id AND c.active
    ORDER BY c.display_order, c.name
  LOOP
    SELECT (x.v::numeric) INTO v_hyp_val
    FROM jsonb_array_elements(v_hyp) AS e,
         LATERAL (SELECT e->>'numeric' AS v) x
    WHERE (e->>'class_id') = r.class_id::text
    LIMIT 1;

    v_eff := COALESCE(v_hyp_val, r.current_numeric);
    IF r.current_numeric IS NOT NULL THEN
      v_cur_sum := v_cur_sum + r.current_numeric; v_cur_n := v_cur_n + 1;
    END IF;
    IF v_eff IS NOT NULL THEN
      v_sim_sum := v_sim_sum + v_eff; v_sim_n := v_sim_n + 1;
    END IF;
    v_classes := v_classes || jsonb_build_object(
      'class_id', r.class_id,
      'name', COALESCE(r.display_name, r.name),
      'current', r.current_numeric,
      'hypothetical', v_hyp_val,
      'counts', v_eff IS NOT NULL
    );
  END LOOP;

  -- Trend: earliest vs latest snapshot-week averages (last 90 days).
  WITH weekly AS (
    SELECT date_trunc('week', s.taken_at)::date AS wk, AVG(s.numeric) AS avg_n
    FROM public.grade_snapshots s
    WHERE s.child_id = p_child_id AND s.numeric IS NOT NULL
      AND s.taken_at >= now() - interval '90 days'
    GROUP BY 1
  ),
  ordered AS (
    SELECT avg_n, row_number() OVER (ORDER BY wk) AS rn,
           count(*) OVER () AS n
    FROM weekly
  )
  SELECT (SELECT avg_n FROM ordered WHERE rn = 1),
         (SELECT avg_n FROM ordered WHERE rn = n)
  INTO v_first_avg, v_last_avg;

  IF v_first_avg IS NOT NULL AND v_last_avg IS NOT NULL THEN
    v_trend := jsonb_build_object(
      'first_avg', round(v_first_avg, 2),
      'last_avg',  round(v_last_avg, 2),
      'delta',     round(v_last_avg - v_first_avg, 2),
      'direction', CASE
                     WHEN v_last_avg - v_first_avg > 0.5 THEN 'rising'
                     WHEN v_last_avg - v_first_avg < -0.5 THEN 'falling'
                     ELSE 'steady' END
    );
  END IF;

  RETURN jsonb_build_object(
    'term', v_term,
    'current_gpa',   CASE WHEN v_cur_n > 0 THEN round(v_cur_sum / v_cur_n, 2) END,
    'simulated_gpa', CASE WHEN v_sim_n > 0 THEN round(v_sim_sum / v_sim_n, 2) END,
    'delta', CASE WHEN v_cur_n > 0 AND v_sim_n > 0
                  THEN round(v_sim_sum / v_sim_n - v_cur_sum / v_cur_n, 2) END,
    'class_count', v_cur_n,
    'classes', v_classes,
    'trend', v_trend
  );
END;
$$;

REVOKE ALL ON FUNCTION public.simulate_gpa(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.simulate_gpa(uuid, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed: 50 colleges (GA in-state + Southeast regional + national pre-med).
-- Reference statistics only — every row carries stats_as_of + stats_source,
-- and the UI renders both next to every number ("verify on the college's
-- site"). Bands are 25th-75th percentiles of enrolled students.
-- ---------------------------------------------------------------------------
INSERT INTO public.colleges
  (name, city, state, region, control, selectivity,
   sat_total_25, sat_total_75, act_25, act_75, acceptance_rate_pct,
   undergrad_enrollment, common_app, url, pre_med_note, stats_as_of, stats_source)
VALUES
-- GA in-state (12)
('Emory University','Atlanta','GA','ga_in_state','private','most_selective',1480,1560,33,35,11.0,7197,true,'https://www.emory.edu','Top-ranked medical school and hospital system on campus.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Georgia Institute of Technology','Atlanta','GA','ga_in_state','public','most_selective',1370,1530,31,34,17.0,18966,true,'https://www.gatech.edu','Strong pre-health advising; BME pipeline to med school.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('University of Georgia','Athens','GA','ga_in_state','public','very_selective',1270,1450,28,33,43.0,31539,true,'https://www.uga.edu','Large pre-med advising program; HOPE/Zell Miller eligible.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Georgia State University','Atlanta','GA','ga_in_state','public','moderately_selective',1060,1260,21,27,61.0,28281,true,'https://www.gsu.edu','Downtown Atlanta; strong health-sciences pathways.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Kennesaw State University','Kennesaw','GA','ga_in_state','public','moderately_selective',1080,1270,21,27,68.0,38294,true,'https://www.kennesaw.edu','WellPath nursing and pre-health tracks nearby.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Georgia Southern University','Statesboro','GA','ga_in_state','public','moderately_selective',1050,1240,20,26,70.0,23150,true,'https://www.georgiasouthern.edu','Jiann-Ping Hsu College of Public Health.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Augusta University','Augusta','GA','ga_in_state','public','moderately_selective',1040,1240,20,26,78.0,7213,true,'https://www.augusta.edu','Medical College of Georgia on the same campus — direct pre-med exposure.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Mercer University','Macon','GA','ga_in_state','private','selective',1170,1370,25,31,68.0,4980,true,'https://www.mercer.edu','Mercer School of Medicine pipeline programs.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Spelman College','Atlanta','GA','ga_in_state','private','very_selective',1130,1330,23,30,28.0,2374,true,'https://www.spelman.edu','Top producer of Black women entering medical school.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Morehouse College','Atlanta','GA','ga_in_state','private','selective',1080,1280,21,27,55.0,2554,true,'https://www.morehouse.edu','Morehouse School of Medicine partnership pathway.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Agnes Scott College','Decatur','GA','ga_in_state','private','selective',1150,1350,24,30,70.0,1015,true,'https://www.agnesscott.edu','Small classes; strong pre-health advising.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Georgia College & State University','Milledgeville','GA','ga_in_state','public','selective',1120,1300,22,28,82.0,5712,true,'https://www.gcsu.edu','Georgia''s public liberal arts college; pre-nursing strength.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
-- Southeast regional (18)
('Duke University','Durham','NC','southeast','private','most_selective',1510,1570,34,35,6.0,6718,true,'https://www.duke.edu','Duke University Hospital next door; elite pre-med.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Vanderbilt University','Nashville','TN','southeast','private','most_selective',1500,1570,34,35,7.0,7151,true,'https://www.vanderbilt.edu','Vanderbilt University Medical Center; top pre-med outcomes.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('University of North Carolina at Chapel Hill','Chapel Hill','NC','southeast','public','most_selective',1350,1510,29,34,17.0,20550,true,'https://www.unc.edu','UNC School of Medicine; strong value for pre-med.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('University of Virginia','Charlottesville','VA','southeast','public','most_selective',1400,1530,32,34,19.0,17718,true,'https://www.virginia.edu','UVA Health system; Echols pre-med advising.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Wake Forest University','Winston-Salem','NC','southeast','private','very_selective',1410,1520,32,34,25.0,5542,true,'https://www.wfu.edu','Atrium Health Wake Forest Baptist partnership.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('University of Florida','Gainesville','FL','southeast','public','very_selective',1320,1490,29,33,24.0,35591,true,'https://www.ufl.edu','UF Health; excellent pre-med value.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Florida State University','Tallahassee','FL','southeast','public','selective',1210,1370,26,31,37.0,32936,true,'https://www.fsu.edu','FSU College of Medicine; honors medical scholars.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('University of Miami','Coral Gables','FL','southeast','private','very_selective',1340,1500,30,33,19.0,12299,true,'https://www.miami.edu','Miller School of Medicine; dual-degree options.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Clemson University','Clemson','SC','southeast','public','very_selective',1240,1420,28,32,38.0,22284,true,'https://www.clemson.edu','Strong STEM core for pre-med prerequisites.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('University of South Carolina','Columbia','SC','southeast','public','selective',1180,1370,26,31,62.0,27112,true,'https://www.sc.edu','USC School of Medicine Columbia; honors college.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('North Carolina State University','Raleigh','NC','southeast','public','selective',1230,1410,27,32,40.0,26062,true,'https://www.ncsu.edu','STEM-heavy; good pre-health prerequisite rigor.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('University of Tennessee, Knoxville','Knoxville','TN','southeast','public','selective',1170,1340,25,30,68.0,26413,true,'https://www.utk.edu','UT Health Science Center pipeline.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('The University of Alabama','Tuscaloosa','AL','southeast','public','moderately_selective',1120,1320,23,31,80.0,33435,true,'https://www.ua.edu','Generous merit aid; pre-med honors tracks.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Auburn University','Auburn','AL','southeast','public','selective',1170,1350,25,31,50.0,26123,true,'https://www.auburn.edu','Harrison College of Pharmacy; pre-health advising.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('University of Kentucky','Lexington','KY','southeast','public','moderately_selective',1100,1300,22,29,92.0,21490,true,'https://www.uky.edu','UK HealthCare academic medical center on campus.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Louisiana State University','Baton Rouge','LA','southeast','public','moderately_selective',1090,1280,22,28,76.0,31331,true,'https://www.lsu.edu','LSU Health New Orleans connection.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('University of Mississippi','Oxford','MS','southeast','public','moderately_selective',1050,1260,21,28,97.0,17761,true,'https://www.olemiss.edu','Strong merit scholarships; pre-med advising.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Tulane University','New Orleans','LA','southeast','private','very_selective',1400,1530,32,34,13.0,8452,true,'https://www.tulane.edu','Tulane School of Medicine; public-health focus.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
-- National pre-med (20)
('Harvard University','Cambridge','MA','national','private','most_selective',1500,1580,34,36,4.0,7229,true,'https://www.harvard.edu','Harvard Medical School ecosystem; unmatched pre-med resources.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Yale University','New Haven','CT','national','private','most_selective',1500,1580,33,35,5.0,6780,true,'https://www.yale.edu','Yale School of Medicine; residential college advising.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Princeton University','Princeton','NJ','national','private','most_selective',1510,1580,34,35,4.0,5684,true,'https://www.princeton.edu','No med school on campus; superb pre-health advising.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Stanford University','Stanford','CA','national','private','most_selective',1500,1580,34,35,4.0,8004,true,'https://www.stanford.edu','Stanford Medicine; research access for undergrads.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Johns Hopkins University','Baltimore','MD','national','private','most_selective',1520,1580,34,35,7.0,6413,true,'https://www.jhu.edu','The pre-med benchmark: #1 hospital, research everywhere.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Washington University in St. Louis','St. Louis','MO','national','private','most_selective',1520,1580,33,35,12.0,8274,true,'https://www.wustl.edu','WashU Medicine; famously strong pre-med advising.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Northwestern University','Evanston','IL','national','private','most_selective',1500,1570,33,35,7.0,8746,true,'https://www.northwestern.edu','Feinberg School of Medicine; HPME dual-degree.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Rice University','Houston','TX','national','private','most_selective',1520,1570,34,35,8.0,4718,true,'https://www.rice.edu','Texas Medical Center next door — largest in the world.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Cornell University','Ithaca','NY','national','private','most_selective',1480,1560,33,35,8.0,15967,true,'https://www.cornell.edu','Weill Cornell Medicine; broad pre-health tracks.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Dartmouth College','Hanover','NH','national','private','most_selective',1500,1580,33,35,6.0,4458,true,'https://www.dartmouth.edu','Geisel School of Medicine; tight advising.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Brown University','Providence','RI','national','private','most_selective',1500,1570,34,35,5.0,7712,true,'https://www.brown.edu','Alpert Medical School; PLME 8-year program.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Columbia University','New York','NY','national','private','most_selective',1510,1580,34,35,4.0,8942,true,'https://www.columbia.edu','VP&S; NYC clinical volunteering access.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('University of Pennsylvania','Philadelphia','PA','national','private','most_selective',1500,1570,34,35,6.0,10238,true,'https://www.upenn.edu','Perelman School of Medicine; deep research bench.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Massachusetts Institute of Technology','Cambridge','MA','national','private','most_selective',1520,1580,34,36,5.0,4685,true,'https://www.mit.edu','Pre-med via rigorous STEM; HST with Harvard.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Case Western Reserve University','Cleveland','OH','national','private','very_selective',1420,1530,32,34,27.0,6252,true,'https://www.case.edu','Cleveland Clinic partnership; pre-med powerhouse.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Boston University','Boston','MA','national','private','very_selective',1400,1530,32,34,11.0,18459,true,'https://www.bu.edu','BU School of Medicine; 7-year accelerated program.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('University of Michigan','Ann Arbor','MI','national','public','most_selective',1360,1530,31,34,18.0,32995,true,'https://www.umich.edu','Michigan Medicine; top public pre-med value.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('University of California, Los Angeles','Los Angeles','CA','national','public','most_selective',1290,1510,29,34,9.0,32727,false,'https://www.ucla.edu','David Geffen School of Medicine; UC application (not Common App).','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('Baylor University','Waco','TX','national','private','selective',1200,1380,26,32,57.0,15744,true,'https://www.baylor.edu','Baylor College of Medicine (Houston) connection.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site'),
('University of Pittsburgh','Pittsburgh','PA','national','public','selective',1250,1420,28,33,49.0,23411,true,'https://www.pitt.edu','UPMC academic medical center; early-assurance pathways.','2025-10-01','IPEDS 2024-25 via College Scorecard — reference only, verify on the college site')
ON CONFLICT (name) DO NOTHING;
