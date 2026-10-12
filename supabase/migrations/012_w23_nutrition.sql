-- Migration 012: W23 nutrition tracker — food logs, targets, weekly patterns, food swaps
-- Source: coordinator brief (docs/MODULE-ARCHITECTURE-BATCH2.md was never committed; see BUILD-LOG 2026-10-11)
--
-- HARD DEPENDENCY on 011: rides public.health_subjects (and its age-band
-- helper). Applying 012 without 011 fails loudly at the first REFERENCES —
-- that is intentional.
--
-- Privacy split (the core W23 contract):
--   * food_logs is the teen's DIARY. For subjects 13+ (band 'teen', or
--     'unknown' DOB — fail closed), parents get ZERO rows: the SELECT policy
--     admits only the teen themselves (child-role on that child). Under-13
--     and adult subjects are tenant-visible.
--   * Parents NEVER read the diary directly; they get the aggregates-only
--     RPC nutrition_weekly_patterns() (parent-role on the subject's child).
-- Uncertainty ranges for 18+: the route requires calorie ranges
-- (low/high, high >= low) on adult rows. For <18, calorie/macro columns are
-- NULLABLE-by-schema and the enforce_no_calories_minor() trigger refuses any
-- non-NULL value with 'nutrition_minor_calorie_refusal'.
-- Targets: nutrition_targets.target_kind has NO deficit kind — under-18
-- weight-loss mode is unrepresentable in this schema by design.
-- Real-food-first as data: food_swaps seed + the deterministic supplement
-- gate lives in the route (no supplement columns here).
-- Nutritionix is primary, USDA backstop, Open Food Facts barcode — all
-- server-side (keys never touch the schema).

-- ---------------------------------------------------------------------------
-- food_logs: the diary. Uncertainty ranges are mandatory columns, not
-- optional metadata: calories_low/high are NOT NULL with high >= low.
-- Macros are optional pairs (both NULL, or both present with high >= low).
-- photo_path points into the private 'nutrition-photos' bucket.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.food_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    uuid NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  logged_at     timestamptz NOT NULL DEFAULT now(),
  description   text NOT NULL,
  source        text NOT NULL DEFAULT 'manual'
                CHECK (source IN ('manual','photo_estimate','nutritionix','usda','openfoodfacts','barcode')),
  calories_low  numeric NOT NULL CHECK (calories_low >= 0),
  calories_high numeric NOT NULL CHECK (calories_high >= calories_low),
  protein_g_low  numeric CHECK (protein_g_low >= 0),
  protein_g_high numeric CHECK (protein_g_high >= protein_g_low),
  carbs_g_low    numeric CHECK (carbs_g_low >= 0),
  carbs_g_high   numeric CHECK (carbs_g_high >= carbs_g_low),
  fat_g_low      numeric CHECK (fat_g_low >= 0),
  fat_g_high     numeric CHECK (fat_g_high >= fat_g_low),
  photo_path    text,                              -- <subject_id>/nutrition/<yyyy-mm-dd>/<file> in nutrition-photos
  logged_by     uuid REFERENCES public.users(id),
  data_class    text NOT NULL DEFAULT 'S' CHECK (data_class IN ('S','T','P')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_logs_subject_logged_idx
  ON public.food_logs (subject_id, logged_at DESC);

-- ---------------------------------------------------------------------------
-- enforce_no_calories_minor(): schema backstop for the <18 nutrition age-gate
-- (sol-health §6.7.1). If the subject's band is a minor band (under13 /
-- teen_13_15 / teen_16_17 / unknown — unknown fails closed) and ANY
-- calorie/macro column is non-NULL, the write is refused with the named code
-- 'nutrition_minor_calorie_refusal'. The route checks first; this trigger is
-- the backstop so no write path can smuggle numeric nutrition data for a minor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_no_calories_minor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band text;
BEGIN
  v_band := public.health_subject_age_band(NEW.subject_id);
  IF v_band IN ('under13', 'teen_13_15', 'teen_16_17', 'unknown')
     AND (
       NEW.calories_low  IS NOT NULL OR NEW.calories_high IS NOT NULL OR
       NEW.protein_g_low IS NOT NULL OR NEW.protein_g_high IS NOT NULL OR
       NEW.carbs_g_low   IS NOT NULL OR NEW.carbs_g_high   IS NOT NULL OR
       NEW.fat_g_low     IS NOT NULL OR NEW.fat_g_high     IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'nutrition_minor_calorie_refusal';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS food_logs_no_calories_minor ON public.food_logs;
CREATE TRIGGER food_logs_no_calories_minor
  BEFORE INSERT OR UPDATE ON public.food_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_no_calories_minor();

REVOKE ALL ON FUNCTION public.enforce_no_calories_minor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_no_calories_minor() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- nutrition_targets: the plan. target_kind deliberately has NO deficit /
-- weight-loss kind — an under-18 weight-loss target cannot be represented,
-- by schema. One active target per subject (partial unique index).
-- Targets are set by parents/clinicians (parent-role writes), readable by
-- the tenant.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_targets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id      uuid NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  -- AMENDED 2026-10-12 (§6.7.2): 'clinician_supervised' is the ONLY
  -- deficit-adjacent kind in the system — 18+ only, clinician gate required.
  -- clinician_gate_id references clinician_gates(id); the table is created in
  -- 025 and the FK is added there (keeps 012 self-contained).
  target_kind     text NOT NULL
                  CHECK (target_kind IN ('maintain','athletic_performance','healthy_gain','medical_recovery','clinician_supervised')),
  clinician_gate_id uuid,
  daily_calorie_low  numeric CHECK (daily_calorie_low >= 0),
  daily_calorie_high numeric CHECK (daily_calorie_high >= daily_calorie_low),
  protein_g_target   numeric CHECK (protein_g_target >= 0),
  carbs_g_target     numeric CHECK (carbs_g_target >= 0),
  fat_g_target       numeric CHECK (fat_g_target >= 0),
  set_by          uuid REFERENCES public.users(id),
  active          boolean NOT NULL DEFAULT true,
  notes           text,
  data_class      text NOT NULL DEFAULT 'S' CHECK (data_class IN ('S','T','P')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Gate rule (§6.4/§6.7.2): medical_recovery and clinician_supervised always
  -- require a verified clinician gate; clinician_supervised additionally
  -- requires an adult-band subject (checked via the age-band helper).
  CONSTRAINT nutrition_targets_gate_required
    CHECK (
      (target_kind IN ('medical_recovery','clinician_supervised') AND clinician_gate_id IS NOT NULL)
      OR target_kind NOT IN ('medical_recovery','clinician_supervised')
    ),
  CONSTRAINT nutrition_targets_supervised_adult_only
    CHECK (
      target_kind <> 'clinician_supervised'
      OR public.health_subject_age_band(subject_id) = 'adult'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_targets_one_active_per_subject
  ON public.nutrition_targets (subject_id) WHERE active;

-- ---------------------------------------------------------------------------
-- food_swaps: real-food-first swaps (reference data). Public read.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.food_swaps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_food  text NOT NULL,
  to_food    text NOT NULL,
  why        text NOT NULL,                        -- plain-language, no medical claims
  category   text NOT NULL CHECK (category IN ('drinks','snacks','breakfast','grains','protein','sides','dessert','other')),
  source     text NOT NULL DEFAULT 'pookie',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_food, to_food)
);

ALTER TABLE public.food_swaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS food_swaps_public_read ON public.food_swaps;
CREATE POLICY food_swaps_public_read ON public.food_swaps
  FOR SELECT USING (true);

GRANT SELECT ON public.food_swaps TO anon, authenticated;

INSERT INTO public.food_swaps (from_food, to_food, why, category) VALUES
  ('Sugary soda', 'Sparkling water with fruit', 'Same fizz, no added sugar', 'drinks'),
  ('Energy drink', 'Water and a banana', 'Caffeine-free energy from food and hydration', 'drinks'),
  ('Sports drink (every day)', 'Water', 'Sports drinks are for long workouts, not desk days', 'drinks'),
  ('Soda with meals', 'Milk or water', 'Cuts added sugar without cutting the meal', 'drinks'),
  ('Candy bar', 'Apple with peanut butter', 'Fiber and protein keep you full longer', 'snacks'),
  ('Potato chips', 'Air-popped popcorn', 'More crunch per handful, less oil', 'snacks'),
  ('Sugary cereal', 'Oatmeal with berries', 'Whole grains hold you through the morning', 'breakfast'),
  ('Toaster pastry', 'Whole fruit and a handful of nuts', 'Real food first: fiber plus healthy fat', 'breakfast'),
  ('White bread', 'Whole-grain bread', 'Same sandwich, more fiber', 'grains'),
  ('Fast-food fries', 'Baked potato wedges', 'Potato flavor without the fryer', 'sides'),
  ('Fried chicken', 'Grilled chicken', 'Same protein, less breading and oil', 'protein'),
  ('Ice cream', 'Frozen yogurt or blended frozen banana', 'Cold and creamy with less added sugar', 'dessert')
ON CONFLICT (from_food, to_food) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.food_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_targets ENABLE ROW LEVEL SECURITY;

-- food_logs SELECT: the diary split. Tenant membership first; then:
-- under13/adult subjects -> tenant-visible; teen (or unknown DOB) subjects
-- -> ONLY the teen themselves (child-role on that child). Parents of teens
-- get zero rows here — their path is nutrition_weekly_patterns().
DROP POLICY IF EXISTS food_logs_diary_read ON public.food_logs;
CREATE POLICY food_logs_diary_read ON public.food_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.health_subjects hs
      WHERE hs.id = public.food_logs.subject_id
        AND hs.child_id = ANY (public.current_child_ids())
        AND (
          public.health_subject_age_band(hs.id) IN ('under13','adult')
          OR EXISTS (
            SELECT 1 FROM public.child_access ca
            WHERE ca.user_id = auth.uid()
              AND ca.child_id = hs.child_id
              AND ca.role = 'child'
          )
        )
    )
  );

-- food_logs writes: any tenant member (parent logs for young kids, teen logs
-- own; a child-role caller is already scoped to their own child).
DROP POLICY IF EXISTS food_logs_tenant_insert ON public.food_logs;
CREATE POLICY food_logs_tenant_insert ON public.food_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.food_logs.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  );

DROP POLICY IF EXISTS food_logs_tenant_update ON public.food_logs;
CREATE POLICY food_logs_tenant_update ON public.food_logs
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.food_logs.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.food_logs.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  );

DROP POLICY IF EXISTS food_logs_tenant_delete ON public.food_logs;
CREATE POLICY food_logs_tenant_delete ON public.food_logs
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.food_logs.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  );

-- nutrition_targets: tenant read; parent-role writes (targets are set by
-- parents/clinicians). No DELETE — supersede via active=false.
DROP POLICY IF EXISTS nutrition_targets_tenant_read ON public.nutrition_targets;
CREATE POLICY nutrition_targets_tenant_read ON public.nutrition_targets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.nutrition_targets.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  );

DROP POLICY IF EXISTS nutrition_targets_parent_insert ON public.nutrition_targets;
CREATE POLICY nutrition_targets_parent_insert ON public.nutrition_targets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.health_subjects hs
      JOIN public.child_access ca
        ON ca.child_id = hs.child_id
       AND ca.user_id = auth.uid()
       AND ca.role = 'parent'
      WHERE hs.id = public.nutrition_targets.subject_id
    )
  );

DROP POLICY IF EXISTS nutrition_targets_parent_update ON public.nutrition_targets;
CREATE POLICY nutrition_targets_parent_update ON public.nutrition_targets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.health_subjects hs
      JOIN public.child_access ca
        ON ca.child_id = hs.child_id
       AND ca.user_id = auth.uid()
       AND ca.role = 'parent'
      WHERE hs.id = public.nutrition_targets.subject_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.health_subjects hs
      JOIN public.child_access ca
        ON ca.child_id = hs.child_id
       AND ca.user_id = auth.uid()
       AND ca.role = 'parent'
      WHERE hs.id = public.nutrition_targets.subject_id
    )
  );

-- ---------------------------------------------------------------------------
-- Explicit GRANTs (least privilege). No DELETE grant on nutrition_targets
-- (supersede via active=false). No anon grants on the diary or targets.
-- No agent_reader grants (M1) — same as 011.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.nutrition_targets TO authenticated;

-- ---------------------------------------------------------------------------
-- nutrition_weekly_patterns(p_subject_id): AGGREGATES ONLY. This is the
-- parent's window into nutrition — never the diary. Returns one JSONB
-- object for the trailing 7 days: days logged, entry count, and daily
-- average ranges (calories) + average macro midpoints. No per-entry rows,
-- no descriptions, no photos leave this function.
-- SECURITY DEFINER with an explicit role assert (parent-role on the
-- subject's child, or the teen themselves).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nutrition_weekly_patterns(p_subject_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
  v_band     text;
  v_result   jsonb;
BEGIN
  IF p_subject_id IS NULL THEN
    RAISE EXCEPTION 'health_subject_required';
  END IF;

  SELECT hs.child_id INTO v_child_id
  FROM public.health_subjects hs
  WHERE hs.id = p_subject_id;

  IF v_child_id IS NULL
     OR NOT (v_child_id = ANY (public.current_child_ids())) THEN
    RAISE EXCEPTION 'health_subject_access_denied';
  END IF;

  -- Caller must be a parent on this child, or the teen themselves.
  IF NOT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid()
      AND ca.child_id = v_child_id
      AND ca.role IN ('parent','child')
  ) THEN
    RAISE EXCEPTION 'nutrition_patterns_access_denied';
  END IF;

  v_band := public.health_subject_age_band(p_subject_id);

  -- AMENDED 2026-10-12 (§6.7.3): minor-band subjects -> ENGAGEMENT ONLY.
  -- Calorie/macro averages are refused server-side (null +
  -- detail='engagement_only_minor'); the trigger guarantees there is nothing
  -- to average anyway. 18+ subjects (re-consent enforced on the read path)
  -- get the full output.
  IF v_band IN ('under13', 'teen_13_15', 'teen_16_17', 'unknown') THEN
    WITH week AS (
      SELECT fl.*
      FROM public.food_logs fl
      WHERE fl.subject_id = p_subject_id
        AND fl.logged_at >= date_trunc('day', now()) - interval '6 days'
    )
    -- Engagement only: days logged + entry count. (food_logs carries no
    -- meal_type column, so per-meal breakdowns come from meal_checkins in
    -- 025, not from this RPC.)
    SELECT jsonb_build_object(
      'week_start', (date_trunc('day', now()) - interval '6 days')::date,
      'days_logged', (SELECT count(DISTINCT (w.logged_at::date)) FROM week w),
      'entries', (SELECT count(*) FROM week w),
      'avg_calories_low', NULL,
      'avg_calories_high', NULL,
      'avg_protein_g', NULL,
      'avg_carbs_g', NULL,
      'avg_fat_g', NULL,
      'detail', 'engagement_only_minor'
    ) INTO v_result;
    RETURN v_result;
  END IF;

  WITH week AS (
    SELECT fl.*
    FROM public.food_logs fl
    WHERE fl.subject_id = p_subject_id
      AND fl.logged_at >= date_trunc('day', now()) - interval '6 days'
  )
  SELECT jsonb_build_object(
    'week_start', (date_trunc('day', now()) - interval '6 days')::date,
    'days_logged', (SELECT count(DISTINCT (w.logged_at::date)) FROM week w),
    'entries', (SELECT count(*) FROM week w),
    'avg_calories_low',  (SELECT round(avg(w.calories_low), 1)  FROM week w),
    'avg_calories_high', (SELECT round(avg(w.calories_high), 1) FROM week w),
    'avg_protein_g', (SELECT round(avg((w.protein_g_low + w.protein_g_high) / 2), 1)
                      FROM week w WHERE w.protein_g_low IS NOT NULL),
    'avg_carbs_g',   (SELECT round(avg((w.carbs_g_low + w.carbs_g_high) / 2), 1)
                      FROM week w WHERE w.carbs_g_low IS NOT NULL),
    'avg_fat_g',     (SELECT round(avg((w.fat_g_low + w.fat_g_high) / 2), 1)
                      FROM week w WHERE w.fat_g_low IS NOT NULL),
    'detail', 'full'
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.nutrition_weekly_patterns(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nutrition_weekly_patterns(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage: private 'nutrition-photos' bucket (food_logs.photo_path).
-- Signed URLs minted server-side with short TTL; never public. v1 uploads go
-- through the POST route with service_role (admin client), so these storage
-- policies are defense-in-depth, not the primary path.
-- Path segment 1 = subject_id: <subject_id>/nutrition/<yyyy-mm-dd>/<file>
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('nutrition-photos', 'nutrition-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS nutrition_photos_tenant_select ON storage.objects;
CREATE POLICY nutrition_photos_tenant_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'nutrition-photos'
    AND EXISTS (
      SELECT 1 FROM public.health_subjects hs
      WHERE hs.id = ((storage.foldername(name))[1])::uuid
        AND hs.child_id = ANY (public.current_child_ids())
    )
  );

DROP POLICY IF EXISTS nutrition_photos_tenant_insert ON storage.objects;
CREATE POLICY nutrition_photos_tenant_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'nutrition-photos'
    AND EXISTS (
      SELECT 1 FROM public.health_subjects hs
      WHERE hs.id = ((storage.foldername(name))[1])::uuid
        AND hs.child_id = ANY (public.current_child_ids())
    )
  );
