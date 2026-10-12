-- Migration 034: trails + safety guidance (Squad 1 Safety Track)
--
-- CONTEXT: sol-safety.md §8 (W29), FR-SAFETY-007 gate dependency.
-- Numbering: per APPLY_ORDER.md collision directive (Squad 1 -> 026+).
--
-- CHANGES:
--   1. trail_safety_guidance: official difficulty -> minimum group /
--      supervision guidance mapping, seeded. The LLM never invents
--      supervision advice; cards render from this table.
--   2. trails: curated trail cards from official sources only (Georgia
--      State Parks, NPS, Cobb County Parks). Every card carries source +
--      retrieved date. Rows are seeded by the curation pipeline (official
--      sources, re-verified quarterly by the stale-trail job); no invented
--      rows are seeded here.
--   3. rpc_get_trails: server-side age gating. Under-16: the solo filter is
--      refused (not footnoted); every card carries group-size guidance.
--
-- D7 (MD decision, coarse-only location — architectural constraint):
--   Trail location is city/postal_code/region TEXT ONLY. No geography,
--   point, lat/lng columns; the RPC accepts no precise coordinates.
--   "Nearby" resolution is coarse + caller-supplied city/ZIP.
--
-- SAFETY BLOCK (every card, every age — never omitted, never LLM-generated):
--   source, official difficulty, group guidance, supervision, dusk close,
--   share-my-plan + official park page links.
--
-- IDEMPOTENT: IF NOT EXISTS / constraint guards / CREATE OR REPLACE.
--
-- GRANT MODEL (015 convention): RLS grants nothing new. Trails and guidance
-- are public curated data (SELECT to anon/authenticated); writes are
-- service_role only (curation pipeline). New EXECUTE surface:
-- rpc_get_trails for authenticated (+ service_role).

-- ---------------------------------------------------------------------------
-- Part 1 — trail_safety_guidance (seeded policy table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trail_safety_guidance (
  difficulty text PRIMARY KEY
    CHECK (difficulty IN ('Easy', 'Moderate', 'Hard')),
  min_group_13_15 text NOT NULL,
  min_group_16_17 text NOT NULL,
  notes text NOT NULL
);

INSERT INTO public.trail_safety_guidance (difficulty, min_group_13_15, min_group_16_17, notes)
VALUES
  ('Easy',
   'groups of 2+; an adult or older teen recommended',
   'groups of 2+ recommended',
   'Stay on marked paths. Carry water.'),
  ('Moderate',
   'groups of 3+; go with an adult or group',
   'groups of 2+; share your plan',
   'Not recommended solo under 16. Check daylight remaining before starting.'),
  ('Hard',
   'not recommended under 16 without an experienced adult',
   'groups of 3+ with experience; share your plan',
   'Strenuous terrain. Turn back before dusk regardless of plan.')
ON CONFLICT (difficulty) DO NOTHING;

COMMENT ON TABLE public.trail_safety_guidance IS
  'Official difficulty -> supervision guidance mapping (sol-safety §8.2). Rendered verbatim on every trail card; the LLM never invents supervision advice.';

ALTER TABLE public.trail_safety_guidance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trail_safety_guidance_read ON public.trail_safety_guidance;
CREATE POLICY trail_safety_guidance_read ON public.trail_safety_guidance
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Part 2 — trails (official sources only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  park_authority text NOT NULL,
  authority_url text,
  difficulty_official text NOT NULL REFERENCES public.trail_safety_guidance(difficulty),
  length_mi numeric,
  group_guidance_13_15 text NOT NULL,
  group_guidance_16_17 text NOT NULL,
  closes_at_dusk boolean NOT NULL DEFAULT true,
  city text,
  postal_code text,
  region text NOT NULL DEFAULT 'US-GA',
  source_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trails_region_city_idx
  ON public.trails (region, city);

COMMENT ON TABLE public.trails IS
  'Curated trail cards from official sources only (Georgia State Parks, NPS, Cobb County Parks). No scraped blogs, no AI-invented difficulty. D7: city/postal_code/region are coarse TEXT — no precise coordinates are stored (architectural constraint). Rows are seeded by the curation pipeline and re-verified quarterly by the stale-trail job.';

ALTER TABLE public.trails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trails_read ON public.trails;
CREATE POLICY trails_read ON public.trails
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Part 3 — rpc_get_trails (server-side age gating)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_trails(
  p_child_id uuid,
  p_city text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_difficulty text DEFAULT NULL,
  p_solo_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_tier text;
  v_cards jsonb;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_child_id IS NULL THEN RAISE EXCEPTION 'child_required'; END IF;
  IF NOT (public.is_teen_of(p_child_id)
          OR EXISTS (SELECT 1 FROM public.child_access ca
                      WHERE ca.child_id = p_child_id AND ca.user_id = v_caller
                        AND ca.role = 'parent' AND ca.status = 'active')) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  v_tier := public.child_age_tier(p_child_id);

  -- No solo-hike recommendations <16: the solo filter is refused server-side
  -- (not shown-locked, not footnoted).
  IF p_solo_only AND v_tier IN ('t13_15', 'under13', 'unknown') THEN
    RAISE EXCEPTION 'solo_filter_unavailable_under_16';
  END IF;
  IF p_difficulty IS NOT NULL
     AND p_difficulty NOT IN ('Easy', 'Moderate', 'Hard') THEN
    RAISE EXCEPTION 'invalid_difficulty';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.name), '[]'::jsonb)
    INTO v_cards
  FROM (
    SELECT t.id, t.name, t.park_authority, t.authority_url,
           t.difficulty_official, t.length_mi, t.city, t.postal_code,
           t.closes_at_dusk, t.source_verified_at,
           CASE WHEN v_tier IN ('t13_15', 'under13', 'unknown')
                THEN t.group_guidance_13_15
                ELSE t.group_guidance_16_17 END AS group_guidance,
           g.notes AS supervision_notes,
           jsonb_build_object(
             'source', t.park_authority,
             'source_verified_at', t.source_verified_at,
             'difficulty', t.difficulty_official,
             'group_guidance', CASE WHEN v_tier IN ('t13_15', 'under13', 'unknown')
                                    THEN t.group_guidance_13_15
                                    ELSE t.group_guidance_16_17 END,
             'closes_at_dusk', t.closes_at_dusk,
             'official_page', t.authority_url
           ) AS safety_block
      FROM public.trails t
      JOIN public.trail_safety_guidance g
        ON g.difficulty = t.difficulty_official
     WHERE (p_city IS NULL OR t.city ILIKE '%' || p_city || '%')
       AND (p_postal_code IS NULL OR t.postal_code = p_postal_code)
       AND (p_difficulty IS NULL OR t.difficulty_official = p_difficulty)
     LIMIT 50
  ) c;

  RETURN jsonb_build_object('trails', v_cards);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_trails(uuid, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_trails(uuid, text, text, text, boolean)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. 13-15 with p_solo_only=true -> solo_filter_unavailable_under_16.
-- 2. Cards carry safety_block with source + verified date + group guidance.
-- 3. No lat/lng columns exist on trails (D7).
-- 4. check.sh passes.
