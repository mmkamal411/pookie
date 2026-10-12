-- Migration 032: College inputs — GSFC methodologies, 504/IEP plans, GA graduation audit
--
-- FR-SCHOOL-009 (GSFC exactly: HOPE 3.0 core + rigor; Zell Miller 3.7 + 1200/26;
--   date-stamped; every surface shows methodology version + "Verify at GAfutures.org"),
-- FR-SCHOOL-012 (504/IEP: store the plan, track delivery, log review dates),
-- FR-SCHOOL-013 (GA 23-credit graduation audit, deterministic).
--
-- METHODOLOGY DISCIPLINE: scholarship_methodologies and graduation_requirements
-- are VERSIONED rows. Re-verified against GAfutures.org at least each August;
-- version bumps are logged; old calculations keep their version stamp.
--
-- IDEMPOTENT: IF NOT EXISTS / idempotent seeds via ON CONFLICT.

-- ---------------------------------------------------------------------------
-- scholarship_methodologies: versioned GSFC rules (HOPE / Zell Miller)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scholarship_methodologies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,                  -- 'HOPE Scholarship' | 'Zell Miller Scholarship'
  version        text NOT NULL,                  -- e.g. 'gsfc-2026.1'
  effective_date date NOT NULL,
  verified_at    timestamptz NOT NULL DEFAULT now(),
  verified_by    text NOT NULL,                  -- who verified (panel member / staff)
  source_url     text NOT NULL DEFAULT 'https://www.gafutures.org',
  rules_json     jsonb NOT NULL,                 -- { core_gpa_min, rigor_required, test_min:{sat, act}, ... }
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

ALTER TABLE public.scholarship_methodologies ENABLE ROW LEVEL SECURITY;

-- Reference data: readable by every authenticated user (methodology transparency).
DROP POLICY IF EXISTS scholarship_methodologies_read ON public.scholarship_methodologies;
CREATE POLICY scholarship_methodologies_read ON public.scholarship_methodologies
  FOR SELECT USING (true);

-- Writes: staff/panel tooling via service_role only (methodology changes are
-- versioned releases, never client edits).

-- Seed: GSFC 2026-2027 rules (verified 2026-10-12 against GAfutures.org;
-- re-verify each August per FR-SCHOOL-009).
INSERT INTO public.scholarship_methodologies
  (name, version, effective_date, verified_by, source_url, rules_json)
VALUES
  ('HOPE Scholarship', 'gsfc-2026.1', '2026-08-01', 'education-panel',
   'https://www.gafutures.org',
   '{"core_gpa_min": 3.0, "rigor_required": true,
     "note": "3.0 core GPA on college-prep diploma + rigor requirements. Verify at GAfutures.org."}'::jsonb),
  ('Zell Miller Scholarship', 'gsfc-2026.1', '2026-08-01', 'education-panel',
   'https://www.gafutures.org',
   '{"core_gpa_min": 3.7, "rigor_required": true,
     "test_min": {"sat": 1200, "act": 26},
     "note": "3.7 core GPA + 1200 SAT (single sitting) or 26 ACT composite + rigor. Verify at GAfutures.org."}'::jsonb)
ON CONFLICT (name, version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 504/IEP accommodation tracking (FR-SCHOOL-012)
-- The signed plan document lives in the vault (document_ref); accommodations
-- are structured rows, not PDF-only. Delivery gaps are phrased neutrally for
-- counselor conversation, never as accusations.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accommodation_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id         uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  plan_type        text NOT NULL CHECK (plan_type IN ('504','IEP')),
  plan_year        text NOT NULL,
  document_ref     text,                          -- vault pointer to the signed plan
  review_date      date,
  next_review_date date,
  case_manager     text,
  school_year      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plan_accommodations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           uuid NOT NULL REFERENCES public.accommodation_plans(id) ON DELETE CASCADE,
  description       text NOT NULL,               -- e.g. "extended time 1.5x"
  setting           text NOT NULL CHECK (setting IN ('classroom','testing','both')),
  responsible_party text,                        -- teacher / counselor / admin
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accommodation_delivery_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          uuid NOT NULL REFERENCES public.accommodation_plans(id) ON DELETE CASCADE,
  accommodation_id uuid REFERENCES public.plan_accommodations(id) ON DELETE SET NULL,
  log_date         date NOT NULL,
  delivered        boolean NOT NULL,
  evidence         text,
  noted_by         text CHECK (noted_by IN ('teen','parent','teacher')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accommodation_plans_child_idx ON public.accommodation_plans (child_id);
CREATE INDEX IF NOT EXISTS plan_accommodations_plan_idx ON public.plan_accommodations (plan_id);
CREATE INDEX IF NOT EXISTS accommodation_delivery_log_plan_date_idx
  ON public.accommodation_delivery_log (plan_id, log_date DESC);

ALTER TABLE public.accommodation_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_accommodations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accommodation_delivery_log ENABLE ROW LEVEL SECURITY;

-- Tenant members read; the teen sees their own plan in full (self-advocacy).
DROP POLICY IF EXISTS accommodation_plans_tenant_read ON public.accommodation_plans;
CREATE POLICY accommodation_plans_tenant_read ON public.accommodation_plans
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS plan_accommodations_tenant_read ON public.plan_accommodations;
CREATE POLICY plan_accommodations_tenant_read ON public.plan_accommodations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.accommodation_plans ap
             WHERE ap.id = public.plan_accommodations.plan_id
               AND ap.child_id = ANY (public.current_child_ids()))
  );

DROP POLICY IF EXISTS accommodation_delivery_log_tenant_read ON public.accommodation_delivery_log;
CREATE POLICY accommodation_delivery_log_tenant_read ON public.accommodation_delivery_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.accommodation_plans ap
             WHERE ap.id = public.accommodation_delivery_log.plan_id
               AND ap.child_id = ANY (public.current_child_ids()))
  );

-- Writes: parent-role (plans are family-managed documents; delivery log notes
-- may come from teen/parent/teacher via the service layer).
DROP POLICY IF EXISTS accommodation_plans_parent_write ON public.accommodation_plans;
CREATE POLICY accommodation_plans_parent_write ON public.accommodation_plans
  FOR ALL
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.accommodation_plans.child_id
                  AND ca.role = 'parent')
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.accommodation_plans.child_id
                  AND ca.role = 'parent')
  );

DROP POLICY IF EXISTS accommodation_delivery_log_parent_write ON public.accommodation_delivery_log;
CREATE POLICY accommodation_delivery_log_parent_write ON public.accommodation_delivery_log
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.accommodation_plans ap
             WHERE ap.id = public.accommodation_delivery_log.plan_id
               AND ap.child_id = ANY (public.current_child_ids())
               AND EXISTS (SELECT 1 FROM public.child_access ca
                           WHERE ca.user_id = public.safe_auth_uid()
                             AND ca.child_id = ap.child_id
                             AND ca.role = 'parent'))
  );

-- ---------------------------------------------------------------------------
-- GA 23-credit graduation audit (FR-SCHOOL-013)
-- Deterministic audit logic lives in src/server/services/graduation.ts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.graduation_requirements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state            text NOT NULL DEFAULT 'GA',
  version          text NOT NULL,                 -- e.g. 'ga-2026.1'
  total_credits    numeric NOT NULL,
  subject_rules    jsonb NOT NULL,               -- [{subject, required}, ...]
  effective_date   date NOT NULL,
  verified_by      text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state, version)
);

ALTER TABLE public.graduation_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS graduation_requirements_read ON public.graduation_requirements;
CREATE POLICY graduation_requirements_read ON public.graduation_requirements
  FOR SELECT USING (true);

-- Seed: Georgia 23-credit requirements (verified 2026-10-12; re-verify on state updates).
INSERT INTO public.graduation_requirements
  (state, version, total_credits, subject_rules, effective_date, verified_by)
VALUES
  ('GA', 'ga-2026.1', 23,
   '[{"subject":"ELA","required":4},
      {"subject":"Math","required":4},
      {"subject":"Science","required":4},
      {"subject":"Social Studies","required":3},
      {"subject":"Health/PE","required":1},
      {"subject":"CTAE/FineArts/WorldLang","required":3},
      {"subject":"Electives","required":4}]'::jsonb,
   '2026-08-01', 'education-panel')
ON CONFLICT (state, version) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.course_completions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  course_name    text NOT NULL,
  subject_area   text NOT NULL,                  -- bucket per graduation_requirements
  credits_earned numeric NOT NULL CHECK (credits_earned >= 0),
  in_progress    boolean NOT NULL DEFAULT false,
  grade          numeric,
  term           text,
  counts_toward  text,                           -- FK-ish to subject_rules[].subject
  source         text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','sync')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_completions_child_idx ON public.course_completions (child_id);

ALTER TABLE public.course_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_completions_tenant_read ON public.course_completions;
CREATE POLICY course_completions_tenant_read ON public.course_completions
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS course_completions_parent_write ON public.course_completions;
CREATE POLICY course_completions_parent_write ON public.course_completions
  FOR ALL
  USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.course_completions.child_id
                  AND ca.role = 'parent')
  )
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = public.safe_auth_uid()
                  AND ca.child_id = public.course_completions.child_id
                  AND ca.role = 'parent')
  );
