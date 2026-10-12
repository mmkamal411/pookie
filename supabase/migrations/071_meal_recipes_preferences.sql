-- Migration 071: Meal Recipes + Family Preferences (Phase1 W13 elevate)
--
-- Extends the W13 meal-planning surface (sol-health section 6.3):
--   meal_recipes: saved recipes with structured ingredients, optional
--     instructions/photo/tags, favorites. Ingredients drive the smart
--     shopping-list generator (quantities summed, units normalized).
--   meal_preferences: per-person likes / dislikes / allergen flags used to
--     warn during planning. Explicit entry only; no inference.
--
-- Tier: H1 (Everyday wellness). No calorie fields, no food logs. meal_plans
-- rows stay plan-name only; recipe ids stored on the plan days are H1 too.
--
-- Status: DRAFT. Depends on the health legal-review gate (022+) clearing.

-- ---------------------------------------------------------------------------
-- meal_recipes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meal_recipes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   uuid NOT NULL,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  -- [{name, quantity, unit}]: quantity numeric (default 1), unit text (default "")
  ingredients  jsonb NOT NULL DEFAULT '[]'::jsonb,
  instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 4000),
  photo_url    text,
  tags         text[] NOT NULL DEFAULT '{}',
  favorite     boolean NOT NULL DEFAULT false,
  health_tier  text NOT NULL DEFAULT 'H1' CHECK (health_tier = 'H1'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meal_recipes_subject_idx
  ON public.meal_recipes (subject_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS meal_recipes_name_trgm
  ON public.meal_recipes USING gin (name gin_trgm_ops);

ALTER TABLE public.meal_recipes ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- meal_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meal_preferences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     uuid NOT NULL,
  -- Free-text household label: "Dawson", "Mom", "Dad". One row per person.
  person_label   text NOT NULL CHECK (char_length(person_label) BETWEEN 1 AND 60),
  likes          text[] NOT NULL DEFAULT '{}',
  dislikes       text[] NOT NULL DEFAULT '{}',
  allergen_flags text[] NOT NULL DEFAULT '{}',
  health_tier    text NOT NULL DEFAULT 'H1' CHECK (health_tier = 'H1'),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, person_label)
);

CREATE INDEX IF NOT EXISTS meal_preferences_subject_idx
  ON public.meal_preferences (subject_id);

ALTER TABLE public.meal_preferences ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS: the tier predicate in actions.ts enforces visibility in code; RLS is
-- the backstop. Policies here mirror the meal_plans grant: subject and
-- linked members of the child may read/write; H1 is parent/steward-visible.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS meal_recipes_member_rw ON public.meal_recipes;
CREATE POLICY meal_recipes_member_rw ON public.meal_recipes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.child_access ca
      WHERE ca.child_id = meal_recipes.subject_id
        AND ca.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_access ca
      WHERE ca.child_id = meal_recipes.subject_id
        AND ca.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS meal_preferences_member_rw ON public.meal_preferences;
CREATE POLICY meal_preferences_member_rw ON public.meal_preferences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.child_access ca
      WHERE ca.child_id = meal_preferences.subject_id
        AND ca.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_access ca
      WHERE ca.child_id = meal_preferences.subject_id
        AND ca.user_id = auth.uid()
    )
  );
