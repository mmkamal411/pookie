-- Migration 012: W23 AI calorie & nutrition tracker
-- Depends on 011 (rides the health_subjects registry).
-- Sources: BUILD-LOG 2026-10-11 (Technical Architect batch-2 spec decisions),
-- AI-MOTHER-VISION.md W23, docs/GUIDANCE-FRAMEWORK.md (shame-free language,
-- no weight/BMI numbers to the child, no weight-loss mode under 18).
--
-- Privacy: the teen's food log is THEIRS. Parents get the
-- nutrition_weekly_patterns() aggregates-only RPC — never the plate-by-plate
-- diary. A teen may share the diary explicitly (nutrition_sharing); a parent
-- cannot silently widen access.
--
-- Under-18 weight-loss mode is UNREPRESENTABLE: nutrition_targets has no
-- deficit/goal/calorie-restriction column by design (there is nothing to
-- set), and the route layer refuses restriction-framed requests for minors.
-- Targets are nourishment floors only (protein, fiber, water, energy floor).
--
-- Uncertainty is a first-class citizen: photo entries MUST carry a calorie
-- range (route refuses without it; CHECK below is the backstop). The app
-- never presents an estimate as a measurement.
--
-- Conventions: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF EXISTS,
-- explicit least-privilege GRANTs (authenticated only — NO anon, NO
-- agent_reader on nutrition tables), definer fns pin search_path +
-- REVOKE ALL FROM PUBLIC.

-- ---------------------------------------------------------------------------
-- nutrition_entries: the teen's own food log (diary)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_entries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   uuid        NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  logged_at    timestamptz NOT NULL DEFAULT now(),
  meal         text        NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  description  text        NOT NULL CHECK (char_length(description) BETWEEN 1 AND 300),
  -- items: [{name, calories, protein_g, fiber_g, sodium_mg, sugar_g,
  --          calories_lo, calories_hi, estimate: true|false}]
  items        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  calories     double precision CHECK (calories IS NULL OR calories >= 0),
  protein_g    double precision CHECK (protein_g IS NULL OR protein_g >= 0),
  fiber_g      double precision CHECK (fiber_g IS NULL OR fiber_g >= 0),
  sodium_mg    double precision CHECK (sodium_mg IS NULL OR sodium_mg >= 0),
  sugar_g      double precision CHECK (sugar_g IS NULL OR sugar_g >= 0),
  -- Visible uncertainty: photo estimates MUST carry a range. Never false
  -- precision ("about a fist of rice ≈ 200 cal", not "rice: 203 cal").
  calories_lo  double precision CHECK (calories_lo IS NULL OR calories_lo >= 0),
  calories_hi  double precision CHECK (calories_hi IS NULL OR calories_hi >= 0),
  source       text        NOT NULL DEFAULT 'manual' CHECK (source IN (
    'natural', 'barcode', 'photo', 'manual'
  )),
  photo_path   text,  -- storage path under nutrition-photos/<owner_uid>/<subject_id>/...
  data_class   text    NOT NULL DEFAULT 'S',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_photo_needs_range CHECK (
    source <> 'photo'
    OR (calories_lo IS NOT NULL AND calories_hi IS NOT NULL AND calories_lo < calories_hi)
  )
);

CREATE INDEX IF NOT EXISTS nutrition_entries_subject_day_idx
  ON public.nutrition_entries (subject_id, logged_at DESC);

ALTER TABLE public.nutrition_entries ENABLE ROW LEVEL SECURITY;

-- SELECT: the subject themself, or a parent holding an explicit diary share.
-- Parents WITHOUT a share see NOTHING here — patterns go through the RPC.
DROP POLICY IF EXISTS nutrition_entries_select ON public.nutrition_entries;
CREATE POLICY nutrition_entries_select ON public.nutrition_entries
  FOR SELECT USING (
    public.health_subject_user(subject_id) = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.nutrition_sharing ns
      JOIN public.health_subjects s ON s.id = ns.subject_id
      WHERE ns.subject_id = nutrition_entries.subject_id
        AND ns.scope = 'diary'
        AND s.subject_kind = 'child'
        AND EXISTS (
          SELECT 1 FROM public.child_access ca
          WHERE ca.child_id = s.subject_id
            AND ca.user_id = auth.uid()
            AND ca.role = 'parent'
        )
    )
  );

-- INSERT: the subject themself only (it is THEIR log).
DROP POLICY IF EXISTS nutrition_entries_insert ON public.nutrition_entries;
CREATE POLICY nutrition_entries_insert ON public.nutrition_entries
  FOR INSERT WITH CHECK (
    public.health_subject_user(subject_id) = auth.uid()
  );

-- Append-only diary: no client UPDATE/DELETE.

GRANT SELECT, INSERT ON public.nutrition_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_entries TO service_role;

-- ---------------------------------------------------------------------------
-- nutrition_hydration: water log (separate from meals, same privacy)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_hydration (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid        NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  logged_at   timestamptz NOT NULL DEFAULT now(),
  ml          double precision NOT NULL CHECK (ml > 0 AND ml <= 2000),
  data_class  text        NOT NULL DEFAULT 'S',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nutrition_hydration_subject_day_idx
  ON public.nutrition_hydration (subject_id, logged_at DESC);

ALTER TABLE public.nutrition_hydration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nutrition_hydration_select ON public.nutrition_hydration;
CREATE POLICY nutrition_hydration_select ON public.nutrition_hydration
  FOR SELECT USING (
    public.health_subject_user(subject_id) = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.nutrition_sharing ns
      JOIN public.health_subjects s ON s.id = ns.subject_id
      WHERE ns.subject_id = nutrition_hydration.subject_id
        AND ns.scope = 'diary'
        AND s.subject_kind = 'child'
        AND EXISTS (
          SELECT 1 FROM public.child_access ca
          WHERE ca.child_id = s.subject_id
            AND ca.user_id = auth.uid()
            AND ca.role = 'parent'
        )
    )
  );

DROP POLICY IF EXISTS nutrition_hydration_insert ON public.nutrition_hydration;
CREATE POLICY nutrition_hydration_insert ON public.nutrition_hydration
  FOR INSERT WITH CHECK (
    public.health_subject_user(subject_id) = auth.uid()
  );

GRANT SELECT, INSERT ON public.nutrition_hydration TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_hydration TO service_role;

-- ---------------------------------------------------------------------------
-- nutrition_targets: nourishment floors ONLY.
-- There is deliberately NO deficit / calorie-goal / weight-loss column.
-- Under-18 weight-loss mode is unrepresentable in this schema: there is
-- nothing to set, nowhere to store it, no route that accepts it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_targets (
  subject_id       uuid PRIMARY KEY REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  protein_g        double precision CHECK (protein_g IS NULL OR protein_g >= 0),
  fiber_g          double precision CHECK (fiber_g IS NULL OR fiber_g >= 0),
  water_ml         double precision CHECK (water_ml IS NULL OR water_ml >= 0),
  energy_floor_cal double precision CHECK (energy_floor_cal IS NULL OR energy_floor_cal >= 0),
  -- energy_floor_cal is a MINIMUM adequate intake ("fuel for the day"),
  -- never a ceiling, never a deficit. Framed as nourishment, not restriction.
  note             text CHECK (note IS NULL OR char_length(note) <= 280),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nutrition_targets IS
  'Nourishment floors only. No deficit/weight-loss columns exist by design — '
  'under-18 weight-loss mode is unrepresentable in this schema.';

ALTER TABLE public.nutrition_targets ENABLE ROW LEVEL SECURITY;

-- SELECT: the subject, or a parent of the subject''s child (targets are
-- care-planning, not the diary).
DROP POLICY IF EXISTS nutrition_targets_select ON public.nutrition_targets;
CREATE POLICY nutrition_targets_select ON public.nutrition_targets
  FOR SELECT USING (
    public.health_subject_user(subject_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.health_subjects s
      WHERE s.id = subject_id
        AND s.subject_kind = 'child'
        AND EXISTS (
          SELECT 1 FROM public.child_access ca
          WHERE ca.child_id = s.subject_id
            AND ca.user_id = auth.uid()
            AND ca.role = 'parent'
        )
    )
  );

-- Writes: the subject themself, or a parent (collaborative care-planning).
-- The route layer additionally refuses restriction-framed requests for minors.
DROP POLICY IF EXISTS nutrition_targets_write ON public.nutrition_targets;
CREATE POLICY nutrition_targets_write ON public.nutrition_targets
  FOR ALL USING (
    public.health_subject_user(subject_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.health_subjects s
      WHERE s.id = subject_id
        AND s.subject_kind = 'child'
        AND EXISTS (
          SELECT 1 FROM public.child_access ca
          WHERE ca.child_id = s.subject_id
            AND ca.user_id = auth.uid()
            AND ca.role = 'parent'
        )
    )
  )
  WITH CHECK (
    public.health_subject_user(subject_id) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.health_subjects s
      WHERE s.id = subject_id
        AND s.subject_kind = 'child'
        AND EXISTS (
          SELECT 1 FROM public.child_access ca
          WHERE ca.child_id = s.subject_id
            AND ca.user_id = auth.uid()
            AND ca.role = 'parent'
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_targets TO service_role;

-- ---------------------------------------------------------------------------
-- nutrition_sharing: the teen's explicit diary/patterns shares
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_sharing (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid        NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  scope       text        NOT NULL CHECK (scope IN ('diary', 'patterns')),
  audience    text        NOT NULL DEFAULT 'parent' CHECK (audience = 'parent'),
  created_by  uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, scope)
);

ALTER TABLE public.nutrition_sharing ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant members (parents see what is shared with them).
DROP POLICY IF EXISTS nutrition_sharing_select ON public.nutrition_sharing;
CREATE POLICY nutrition_sharing_select ON public.nutrition_sharing
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.health_subjects s
      WHERE s.id = subject_id
        AND (
          s.owner_user_id = auth.uid()
          OR (s.subject_kind = 'child' AND s.subject_id = ANY (public.current_child_ids()))
        )
    )
  );

-- Writes: the subject themself ONLY (no silent parent widening).
DROP POLICY IF EXISTS nutrition_sharing_write ON public.nutrition_sharing;
CREATE POLICY nutrition_sharing_write ON public.nutrition_sharing
  FOR ALL USING (public.health_subject_user(subject_id) = auth.uid())
  WITH CHECK (public.health_subject_user(subject_id) = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_sharing TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_sharing TO service_role;

-- ---------------------------------------------------------------------------
-- food_swaps: real-food-first gap closers (seeded reference data).
-- Whole food leads every suggestion; supplements are never seeded here —
-- the deterministic supplement gate lives in app copy ("talk to your
-- doctor") and is only reachable when food cannot close the gap.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.food_swaps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gap          text NOT NULL CHECK (gap IN ('protein', 'fiber', 'iron', 'hydration', 'energy')),
  food         text NOT NULL,
  why          text NOT NULL,
  prep_minutes int  CHECK (prep_minutes IS NULL OR prep_minutes >= 0),
  active       boolean NOT NULL DEFAULT true
);

ALTER TABLE public.food_swaps ENABLE ROW LEVEL SECURITY;

-- Reference data: every signed-in user may read; nobody writes client-side.
DROP POLICY IF EXISTS food_swaps_select ON public.food_swaps;
CREATE POLICY food_swaps_select ON public.food_swaps
  FOR SELECT USING (active = true);

GRANT SELECT ON public.food_swaps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_swaps TO service_role;

INSERT INTO public.food_swaps (gap, food, why, prep_minutes) VALUES
  ('protein', 'Greek yogurt + berries', 'About 20g protein per cup, no cooking needed.', 2),
  ('protein', 'Chicken thighs (W20 list)', 'Affordable, ~26g protein per thigh; 20-minute sheet-pan dinner.', 20),
  ('protein', 'Two eggs + toast', 'Roughly 12–14g protein; the classic fast breakfast.', 8),
  ('protein', 'Lentil soup', 'About 18g protein per bowl plus fiber; batch-cooks well.', 30),
  ('fiber', 'Oatmeal with banana', 'Around 8g fiber; slow energy for the morning.', 5),
  ('fiber', 'Apple + peanut butter', 'About 4–5g fiber with staying power.', 2),
  ('fiber', 'Black bean tacos', 'Roughly 10g fiber per two tacos; cheap and fast.', 15),
  ('iron', 'Spinach + orange slices', 'Vitamin C helps the body use iron from greens.', 5),
  ('iron', 'Lean beef stir-fry', 'Heme iron the body absorbs easily; pair with peppers.', 20),
  ('hydration', 'Water bottle refill ritual', 'Keep the bottle visible; aim for steady sips, not chugs.', 0),
  ('energy', 'Banana + handful of walnuts', 'Quick fuel plus staying power before practice.', 1),
  ('energy', 'Rice + beans bowl', 'Complete, steady energy; the weeknight workhorse.', 25)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- nutrition-photos: private bucket for plate photos.
-- Path: nutrition-photos/<owner_uid>/<subject_id>/<yyyy-mm-dd>/<file>
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('nutrition-photos', 'nutrition-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS nutrition_photos_owner_select ON storage.objects;
CREATE POLICY nutrition_photos_owner_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'nutrition-photos'
    AND ((storage.foldername(name))[1]) = auth.uid()::text
  );

DROP POLICY IF EXISTS nutrition_photos_owner_insert ON storage.objects;
CREATE POLICY nutrition_photos_owner_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'nutrition-photos'
    AND ((storage.foldername(name))[1]) = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- nutrition_weekly_patterns(p_subject_id): aggregates ONLY.
-- This is what parents get: patterns and nudges, never the plate-by-plate
-- diary. No item names, no descriptions, no photo paths leave this RPC.
-- Callable by the subject themself or a parent of the subject's child.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nutrition_weekly_patterns(p_subject_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind  text;
  v_child uuid;
  v_uid   uuid := auth.uid();
  v_role  text;
  v_out   jsonb;
BEGIN
  SELECT s.subject_kind, s.subject_id
    INTO v_kind, v_child
    FROM public.health_subjects s
    WHERE s.id = p_subject_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_subject'; END IF;

  -- Self always; parent only for child subjects.
  IF public.health_subject_user(p_subject_id) = v_uid THEN
    v_role := 'self';
  ELSIF v_kind = 'child' AND EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.child_id = v_child AND ca.user_id = v_uid AND ca.role = 'parent'
  ) THEN
    v_role := 'parent';
  ELSE
    RAISE EXCEPTION 'parent_membership_required';
  END IF;

  WITH days AS (
    SELECT generate_series(
      date_trunc('day', now()) - interval '6 days',
      date_trunc('day', now()),
      interval '1 day'
    )::date AS d
  ),
  meals AS (
    SELECT date_trunc('day', e.logged_at)::date AS d,
           count(*) AS n,
           count(*) FILTER (WHERE e.meal = 'breakfast') AS breakfasts,
           round(avg(e.calories))::int AS avg_cal,
           round(avg(e.protein_g), 1) AS avg_protein,
           round(avg(e.fiber_g), 1) AS avg_fiber
    FROM public.nutrition_entries e
    WHERE e.subject_id = p_subject_id
      AND e.logged_at >= date_trunc('day', now()) - interval '6 days'
    GROUP BY 1
  ),
  water AS (
    SELECT date_trunc('day', h.logged_at)::date AS d,
           sum(h.ml)::int AS ml
    FROM public.nutrition_hydration h
    WHERE h.subject_id = p_subject_id
      AND h.logged_at >= date_trunc('day', now()) - interval '6 days'
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'days_logged', (SELECT count(*) FROM days d JOIN meals m USING (d) WHERE m.n > 0),
    'meals_logged', (SELECT COALESCE(sum(n), 0) FROM meals),
    'breakfasts_logged', (SELECT COALESCE(sum(breakfasts), 0) FROM meals),
    'avg_calories', (SELECT round(avg(avg_cal))::int FROM meals WHERE avg_cal IS NOT NULL),
    'avg_protein_g', (SELECT round(avg(avg_protein), 1) FROM meals WHERE avg_protein IS NOT NULL),
    'avg_fiber_g', (SELECT round(avg(avg_fiber), 1) FROM meals WHERE avg_fiber IS NOT NULL),
    'avg_water_ml', (SELECT round(avg(ml))::int FROM water),
    'protein_target_g', (SELECT t.protein_g FROM public.nutrition_targets t WHERE t.subject_id = p_subject_id),
    'fiber_target_g', (SELECT t.fiber_g FROM public.nutrition_targets t WHERE t.subject_id = p_subject_id),
    'water_target_ml', (SELECT t.water_ml FROM public.nutrition_targets t WHERE t.subject_id = p_subject_id),
    'viewer', v_role,
    'as_of', now()::text
  ) INTO v_out;

  RETURN v_out;
END
$$;

REVOKE ALL ON FUNCTION public.nutrition_weekly_patterns(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nutrition_weekly_patterns(uuid) TO authenticated, service_role;
