-- Migration 028: Study Sparks (FR-SCHOOL-004, G8, R6)
--
-- The rename is load-bearing: "peer" on AI content is fabricated social proof.
-- Study Sparks = short, labeled, study-skill micro-content. No spark ever
-- claims a human peer wrote it.
--
-- CONTENT RULES (enforced):
--   - Provenance label on every spark (id, body, origin, source_refs, de-identification
--     method, study-skill tags, review status, AI label). No spark renders
--     without a resolvable label.
--   - Study-skills-only fence: deterministic rules in the service layer
--     (src/server/services/sparks.ts); uncertain content is blocked
--     (fail-closed), never shipped.
--   - 4-week TTL: expires_at = created_at + 28 days; nightly purge hard-deletes
--     expired rows (not soft-delete).
--   - De-identification: sparks derive from curriculum documents or the
--     pre-approved technique library ONLY — never from an individual family's
--     grades, check-ins, uploads, or behavior. Aggregate-derived sparks
--     require a k>=5 family cohort (deident_method='aggregate-k5'); the
--     quarterly audit asserts the invariant (see deident_audit view).
--   - Contested topics (evolution, climate, vaccines, historical
--     interpretation, current-events-adjacent): spark_review_queue, 72h SLA,
--     subject-teacher reviewers.
--   - Weekly 5% sampling QA: spark_qa_reviews. Error-rate > 5%/week pauses the
--     pipeline (operational rule, surfaced via qa_error_rate_weekly view).
--
-- IDEMPOTENT: IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- study_sparks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_sparks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id         uuid REFERENCES public.children(id) ON DELETE CASCADE,
                                   -- NULL = global technique-library spark
  class_id         uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  unit_tag         text,
  body             text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 600),
  -- AI label as DATA (not a UI string): survives API responses and exports.
  ai_label         text GENERATED ALWAYS AS
                     ('Made by Pookie AI · checked ' || (created_at::date)::text) STORED,
  origin           text NOT NULL
                   CHECK (origin IN ('ai-synthesis','curriculum-extraction')),
  source_refs      jsonb NOT NULL DEFAULT '[]'::jsonb,   -- syllabus_doc_ids etc.
  deident_method   text NOT NULL
                   CHECK (deident_method IN ('curriculum-only','aggregate-k5')),
  cohort_size      integer,                              -- required when aggregate-k5
  study_skill_tags text[] NOT NULL DEFAULT '{}',         -- e.g. {spaced-repetition}
  review_status    text NOT NULL DEFAULT 'auto'
                   CHECK (review_status IN ('auto','human-approved','qa-sampled')),
  reviewed_by      uuid REFERENCES public.users(id),
  contested        boolean NOT NULL DEFAULT false,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  provenance       text NOT NULL DEFAULT 'app_generated'
                   CHECK (provenance IN ('school_of_record','app_generated')),
  CONSTRAINT sparks_k5_requires_cohort
    CHECK (deident_method <> 'aggregate-k5' OR (cohort_size IS NOT NULL AND cohort_size >= 5))
);

CREATE INDEX IF NOT EXISTS study_sparks_live_idx
  ON public.study_sparks (child_id, class_id, expires_at);
CREATE INDEX IF NOT EXISTS study_sparks_expiry_idx
  ON public.study_sparks (expires_at);

ALTER TABLE public.study_sparks ENABLE ROW LEVEL SECURITY;

-- Tenant read: live (unexpired) sparks for the caller's tenants.
DROP POLICY IF EXISTS study_sparks_tenant_read ON public.study_sparks;
CREATE POLICY study_sparks_tenant_read ON public.study_sparks
  FOR SELECT
  USING (
    expires_at > now()
    AND (child_id IS NULL OR child_id = ANY (public.current_child_ids()))
  );

-- Writes: service_role pipeline only (no client INSERT/UPDATE/DELETE policies —
-- the generation pipeline runs server-side; the fence runs before insert).

-- ---------------------------------------------------------------------------
-- spark_qa_reviews: weekly 5% sampling QA log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spark_qa_reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spark_id     uuid NOT NULL REFERENCES public.study_sparks(id) ON DELETE CASCADE,
  reviewer_id  uuid REFERENCES public.users(id),
  verdict      text NOT NULL CHECK (verdict IN ('pass','fail')),
  reason       text,
  reviewed_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spark_qa_reviews ENABLE ROW LEVEL SECURITY;
-- QA reviewers read/write via service_role pipeline; no client policies (fail-closed).

-- Weekly error-rate view: drives the >5% pipeline-pause rule.
CREATE OR REPLACE VIEW public.spark_qa_error_rate_weekly AS
SELECT date_trunc('week', reviewed_at)::date AS week,
       count(*) AS reviewed,
       count(*) FILTER (WHERE verdict = 'fail') AS failed,
       CASE WHEN count(*) = 0 THEN 0
            ELSE (count(*) FILTER (WHERE verdict = 'fail'))::numeric / count(*) END AS error_rate
  FROM public.spark_qa_reviews
 GROUP BY 1;

-- ---------------------------------------------------------------------------
-- spark_review_queue: contested-topic human review (72h SLA)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spark_review_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spark_id     uuid NOT NULL REFERENCES public.study_sparks(id) ON DELETE CASCADE,
  topic_tag    text NOT NULL,
  enqueued_at  timestamptz NOT NULL DEFAULT now(),
  sla_due      timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  reviewer_id  uuid REFERENCES public.users(id),
  decision     text CHECK (decision IN ('approve','edit_and_approve','reject')),
  decided_at   timestamptz,
  decision_reason text,
  UNIQUE (spark_id)
);

ALTER TABLE public.spark_review_queue ENABLE ROW LEVEL SECURITY;
-- Human reviewers operate via service_role tooling; no client policies (fail-closed).

-- ---------------------------------------------------------------------------
-- Nightly purge: hard-delete expired sparks (4-week TTL).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_sparks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n integer;
BEGIN
  DELETE FROM public.study_sparks WHERE expires_at <= now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_sparks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_sparks() TO service_role;

-- ---------------------------------------------------------------------------
-- De-identification audit view (quarterly automated audit):
-- every row must satisfy the invariant; any row returned = pipeline violation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.study_sparks_deident_violations AS
SELECT id, origin, deident_method, cohort_size, created_at
  FROM public.study_sparks
 WHERE NOT (
   (deident_method = 'curriculum-only')
   OR (deident_method = 'aggregate-k5' AND cohort_size IS NOT NULL AND cohort_size >= 5)
 );
