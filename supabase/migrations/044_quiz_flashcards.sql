-- Migration 029: Quiz pipeline (fail-closed) + source-text flashcards + formula bank
--
-- FR-SCHOOL-005, FR-SCHOOL-018 (G19).
--
-- CURRENT STATE: the machine-verification pipeline (deterministic answer-key
-- verifier, misconception-distractor audit, human spot-check queue) does not
-- exist yet. UNTIL IT EXISTS AND THE PILOT PASSES, the product ships
-- SOURCE-TEXT FLASHCARDS ONLY: verbatim Q/A spans from uploaded material —
-- no AI generation, no distractors. This schema enforces that posture:
--
--   quiz_items.verification_status ∈ {pending, machine_pass, machine_fail,
--     human_review, published, quarantined} — DEFAULT 'quarantined'.
--   The student-visible RLS policy admits ONLY status='published' rows.
--   Nothing reaches a student surface without passing the gate; there is no
--   code path that renders a non-published AI item.
--
-- AI-LABEL PERSISTENCE (data, not UI strings):
--   quiz_items.ai_generated, generated_by_model, verified_by, verified_at,
--   engine_version. The label survives API responses, exports, and screenshots.
--
-- FORMULA BANK (G19): the single grounding source for quizzes, sparks math
-- content, tutor math answers, and SAT formulas. Two-expert sign-off required
-- (verified_by holds both reviewer ids); machine spot-check recorded.
--
-- IDEMPOTENT: IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- flashcards: source-text only (v1 ships this; verbatim spans, no AI)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flashcards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id      uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  unit_tag      text,
  front         text NOT NULL,               -- verbatim span from source
  back          text NOT NULL,               -- verbatim span from source
  source_doc_id uuid,                        -- uploaded unit material
  span_refs     jsonb NOT NULL DEFAULT '[]'::jsonb,  -- page/span citations
  created_by    uuid REFERENCES public.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  provenance    text NOT NULL DEFAULT 'app_generated'
                CHECK (provenance IN ('school_of_record','app_generated'))
);

CREATE INDEX IF NOT EXISTS flashcards_child_class_idx
  ON public.flashcards (child_id, class_id, created_at DESC);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flashcards_tenant_read ON public.flashcards;
CREATE POLICY flashcards_tenant_read ON public.flashcards
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS flashcards_member_insert ON public.flashcards;
CREATE POLICY flashcards_member_insert ON public.flashcards
  FOR INSERT WITH CHECK (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS flashcards_member_delete ON public.flashcards;
CREATE POLICY flashcards_member_delete ON public.flashcards
  FOR DELETE USING (child_id = ANY (public.current_child_ids()));

-- ---------------------------------------------------------------------------
-- quiz_items: AI-generated item staging. FAIL-CLOSED by construction.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id         uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id         uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  unit_tag         text,
  question         text NOT NULL,
  answer_key       text NOT NULL,
  distractors      jsonb NOT NULL DEFAULT '[]'::jsonb,
  misconception_tags text[] NOT NULL DEFAULT '{}',
  source_span_ids  jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- AI label columns (the label is data, not a UI string):
  ai_generated     boolean NOT NULL DEFAULT true,
  generated_by_model text,
  verified_by      text CHECK (verified_by IN ('machine','human')),
  verified_at      timestamptz,
  engine_version   text,
  verification_status text NOT NULL DEFAULT 'quarantined'
    CHECK (verification_status IN
      ('pending','machine_pass','machine_fail','human_review','published','quarantined')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- classes.ai_practice_opt_in: teen-owned per-class toggle, default OFF.
-- Under-13: no AI quizzes (technical ban enforced in the service layer).
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS ai_practice_opt_in boolean NOT NULL DEFAULT false;

ALTER TABLE public.quiz_items ENABLE ROW LEVEL SECURITY;

-- THE fail-closed policy: students/parents see ONLY published rows.
-- Published rows can only be produced by the (future) verification pipeline
-- via service_role. There is deliberately no client INSERT policy.
DROP POLICY IF EXISTS quiz_items_published_read ON public.quiz_items;
CREATE POLICY quiz_items_published_read ON public.quiz_items
  FOR SELECT
  USING (
    verification_status = 'published'
    AND child_id = ANY (public.current_child_ids())
  );

-- ---------------------------------------------------------------------------
-- Opt-in gate trigger: an item may only transition to 'published' when its
-- class has ai_practice_opt_in = true. The pipeline (service_role) cannot
-- publish into a class the teen has not opted in. Fail-closed: NULL class
-- or opt-out blocks the publish.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quiz_items_enforce_optin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_optin boolean;
BEGIN
  IF NEW.verification_status = 'published'
     AND (OLD.verification_status IS DISTINCT FROM 'published') THEN
    SELECT c.ai_practice_opt_in INTO v_optin
      FROM public.classes c WHERE c.id = NEW.class_id;
    IF v_optin IS NOT TRUE THEN
      RAISE EXCEPTION 'quiz_publish_blocked: class not opted in to AI practice';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quiz_items_optin_guard ON public.quiz_items;
CREATE TRIGGER quiz_items_optin_guard
  BEFORE INSERT OR UPDATE OF verification_status ON public.quiz_items
  FOR EACH ROW EXECUTE FUNCTION public.quiz_items_enforce_optin();

-- ---------------------------------------------------------------------------
-- formula_bank: versioned, two-expert-verified grounding source (G19)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.formula_bank (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject         text NOT NULL,                 -- 'math' | 'science'
  name            text NOT NULL,
  latex           text,
  plain_statement text NOT NULL,
  source_citation text NOT NULL,                 -- textbook / College Board ref
  version         text NOT NULL,                 -- bank version, e.g. 'math.v1'
  verified_by     uuid[] NOT NULL DEFAULT '{}',  -- TWO expert reviewer ids required
  verified_at     timestamptz,
  machine_check   text,                          -- 'numeric-spotcheck-pass' | 'n/a' | details
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formula_bank_two_reviewers CHECK (cardinality(verified_by) >= 2)
);

CREATE INDEX IF NOT EXISTS formula_bank_subject_version_idx
  ON public.formula_bank (subject, version);

ALTER TABLE public.formula_bank ENABLE ROW LEVEL SECURITY;

-- Read-only reference data for every authenticated user.
DROP POLICY IF EXISTS formula_bank_public_read ON public.formula_bank;
CREATE POLICY formula_bank_public_read ON public.formula_bank
  FOR SELECT USING (true);

-- Writes: education-panel tooling via service_role only (fail-closed).

-- ---------------------------------------------------------------------------
-- Seed: math.v1 bank — standard, textbook-citable formulas.
-- verified_by is intentionally empty here: these rows are INSERTED BY the
-- panel's sign-off flow in production. They are commented out so no
-- unverified formula can ever render as "verified".
-- ---------------------------------------------------------------------------
-- (Seed rows ship only with two reviewer UUIDs filled by the panel tooling.
--  Leaving them out is the fail-closed choice, not an omission.)
