-- Migration 027: FAQ corpus tables (S1 Help Center).
--
-- Design ref: sol-support §A.5, §D. NUMBERING NOTE: canonical §G map said 045;
-- landing at next free number (027). Compact core: articles, versions,
-- feedback. Search indexes (GIN trgm + tsvector) included; pgvector semantic
-- fallback is a later migration (extension + backfill job).
--
-- IDEMPOTENT: IF NOT EXISTS / DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS public.faq_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  body_md text NOT NULL,
  category text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  age_band text NOT NULL DEFAULT 'all' CHECK (age_band IN ('all', 'teen', 'parent')),
  related_slugs text[] NOT NULL DEFAULT '{}',
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', title || ' ' || array_to_string(keywords, ' ') || ' ' || body_md)
  ) STORED,
  -- Legal accordion fields (sol-support §A.5.2; attorney sign-off gate §E.1)
  legal_note_md text,
  legal_citation text,
  legal_basis text CHECK (legal_basis IN ('law_required', 'our_choice', 'both')),
  legal_reviewed_at date,
  legal_review_due_at date,
  legal_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS faq_articles_search_idx ON public.faq_articles USING gin (search_vector);
CREATE INDEX IF NOT EXISTS faq_articles_slug_idx ON public.faq_articles (slug) WHERE status = 'live';
CREATE INDEX IF NOT EXISTS faq_articles_category_idx ON public.faq_articles (category, status);

CREATE TABLE IF NOT EXISTS public.faq_article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.faq_articles(id) ON DELETE CASCADE,
  version integer NOT NULL,
  body_md text NOT NULL,
  legal_note_md text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, version)
);

CREATE TABLE IF NOT EXISTS public.faq_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.faq_articles(id) ON DELETE CASCADE,
  helpful boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS faq_feedback_article_idx ON public.faq_feedback (article_id, created_at);

COMMENT ON TABLE public.faq_articles IS
  'S1 FAQ corpus. age_band filters server-side; legal accordions need licensed-attorney sign-off before going live (§E.1).';

ALTER TABLE public.faq_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_article_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_feedback ENABLE ROW LEVEL SECURITY;

-- Public read of live articles (age_band filtering happens in the API layer).
DROP POLICY IF EXISTS faq_articles_public_read ON public.faq_articles;
CREATE POLICY faq_articles_public_read ON public.faq_articles
  FOR SELECT TO anon, authenticated USING (status = 'live');

DROP POLICY IF EXISTS faq_feedback_insert ON public.faq_feedback;
CREATE POLICY faq_feedback_insert ON public.faq_feedback
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Writes: service_role only (content-team console uses service_role).
DROP POLICY IF EXISTS faq_service_all ON public.faq_articles;
CREATE POLICY faq_service_all ON public.faq_articles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS faq_versions_service_all ON public.faq_article_versions;
CREATE POLICY faq_versions_service_all ON public.faq_article_versions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS faq_feedback_service_all ON public.faq_feedback;
CREATE POLICY faq_feedback_service_all ON public.faq_feedback
  FOR ALL TO service_role USING (true) WITH CHECK (true);
