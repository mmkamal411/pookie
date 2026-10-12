-- Migration 035: events + vetting model (Squad 1 Safety Track)
--
-- CONTEXT: sol-safety.md §9 (W27), FR-SAFETY-007 gate dependency.
-- Numbering: per APPLY_ORDER.md collision directive (Squad 1 -> 026+).
--
-- CURATION POLICY (in SQL, sol-safety §9.2): every event comes from a public
-- ticket seller, a city/county calendar, a school, a nonprofit, or a
-- verified host. Private-residence events and "DM for address" meetups are
-- never listed. Age tags come from the venue/organizer; when in doubt, tag up.
--
-- CHANGES:
--   1. events: host_type CHECK (anything else cannot be inserted) +
--      is_private_residence exclusion CHECK (defense in depth). age_tag and
--      audience_mode enums. safety_block jsonb (well_lit, populated_area,
--      transit_access, notes — filled at curation, never LLM-guessed).
--      Seed SOURCES (municipal first): Cobb County Parks & Rec, City of
--      Marietta, school calendars, ticket partners. Rows are seeded by the
--      curation pipeline; no invented event rows are seeded here.
--   2. event_reports: user reports -> human review queue (48h SLA).
--   3. rpc_get_events: server-side age/audience filtering. <18: 18+/21+
--      rows EXCLUDED from results (not shown-locked). <13: all_ages + family
--      only. Teen default audience per tier (13-15: family/teen).
--   4. rpc_report_event: teen reports an event (takedown/tag-correction).
--
-- D7 (MD decision, coarse-only location): venue addresses are PUBLIC VENUE
-- data (curation), not the teen's location. User-location input to search is
-- city/postal_code TEXT only; no precise coordinates are accepted or stored
-- for the searcher.
--
-- IDEMPOTENT: IF NOT EXISTS / constraint guards / CREATE OR REPLACE.
--
-- GRANT MODEL (015 convention): RLS grants nothing new. Events are public
-- curated listings (SELECT to anon/authenticated via the RPC; no direct
-- SELECT policy — reads go through rpc_get_events so age gating cannot be
-- bypassed). Writes are service_role only (curation pipeline). New EXECUTE
-- surface: rpc_get_events, rpc_report_event for authenticated (+ service_role).

-- ---------------------------------------------------------------------------
-- Part 1 — events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  description_is_ai_summary boolean NOT NULL DEFAULT false,
  venue_name text NOT NULL,
  venue_address text NOT NULL,
  host_type text NOT NULL
    CHECK (host_type IN ('ticketed_public', 'municipal', 'school',
                         'nonprofit', 'verified_host')),
  host_verification jsonb NOT NULL DEFAULT '{}'::jsonb,
  age_tag text NOT NULL
    CHECK (age_tag IN ('all_ages', '13+', '18+', '21+')),
  age_tag_source text NOT NULL DEFAULT 'pookie_review'
    CHECK (age_tag_source IN ('organizer', 'venue_policy', 'pookie_review')),
  audience_mode text[] NOT NULL DEFAULT '{family,teen}',
  source text NOT NULL,
  source_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  is_private_residence boolean NOT NULL DEFAULT false,
  safety_block jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_count int NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_no_private_residence CHECK (is_private_residence = false),
  CONSTRAINT events_audience_subset
    CHECK (audience_mode <@ ARRAY['family', 'teen', 'grown_up'])
);

CREATE INDEX IF NOT EXISTS events_starts_idx
  ON public.events (starts_at) WHERE starts_at > now();
CREATE INDEX IF NOT EXISTS events_age_tag_idx
  ON public.events (age_tag);

COMMENT ON TABLE public.events IS
  'Vetted event listings (sol-safety §9.2). The curation policy is in SQL: host_type CHECK means anything outside {ticketed_public, municipal, school, nonprofit, verified_host} cannot be inserted; events_no_private_residence rejects private-residence rows at insert (defense in depth). Age tags come from venue/organizer; when in doubt, tag up. safety_block is filled at curation, never LLM-guessed. Seed sources (municipal first): Cobb County Parks & Rec calendar, City of Marietta events calendar, school district calendars, ticket partners, manual-review queue for nonprofit/verified-host submissions.';

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for anon/authenticated: reads go through rpc_get_events
-- so the age gate cannot be bypassed by direct PostgREST reads.

-- ---------------------------------------------------------------------------
-- Part 2 — event_reports (human review queue)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reporter_child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  outcome text CHECK (outcome IN ('upheld', 'tag_corrected', 'removed', 'dismissed'))
);

COMMENT ON TABLE public.event_reports IS
  'User event reports -> human review queue (48h SLA -> takedown or tag correction; reporter notified of outcome).';

ALTER TABLE public.event_reports ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Part 3 — rpc_get_events (server-side age/audience filter)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_events(
  p_child_id uuid,
  p_city text DEFAULT NULL,
  p_audience text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_tier text;
  v_audience text[];
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

  -- Audience default per tier (13-15: family/teen; 16-17: teen default with
  -- grown_up visible-but-flagged; switchable where age allows).
  IF p_audience IS NOT NULL THEN
    IF p_audience NOT IN ('family', 'teen', 'grown_up') THEN
      RAISE EXCEPTION 'invalid_audience';
    END IF;
    IF v_tier IN ('t13_15', 'under13', 'unknown') AND p_audience = 'grown_up' THEN
      RAISE EXCEPTION 'audience_not_allowed';
    END IF;
    v_audience := ARRAY[p_audience];
  ELSIF v_tier IN ('t13_15', 'under13', 'unknown') THEN
    v_audience := ARRAY['family', 'teen'];
  ELSE
    v_audience := ARRAY['family', 'teen', 'grown_up'];
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.starts_at), '[]'::jsonb)
    INTO v_cards
  FROM (
    SELECT e.id, e.title,
           CASE WHEN e.description_is_ai_summary
                THEN e.description || ' [AI summary]' ELSE e.description END
             AS description,
           e.description_is_ai_summary,
           e.venue_name, e.venue_address, e.host_type,
           e.age_tag, e.age_tag_source, e.audience_mode,
           e.source, e.source_url, e.starts_at, e.ends_at, e.safety_block
      FROM public.events e
     WHERE e.starts_at > now()
       -- Age gate: <18 -> 18+/21+ EXCLUDED from results (not shown-locked).
       AND (v_tier NOT IN ('t13_15', 't16_17', 'under13', 'unknown')
            OR e.age_tag IN ('all_ages', '13+'))
       -- <13 -> all_ages + family only.
       AND (v_tier NOT IN ('under13', 'unknown')
            OR (e.age_tag = 'all_ages' AND e.audience_mode @> ARRAY['family']))
       AND e.audience_mode && v_audience
       AND (p_city IS NULL OR e.venue_address ILIKE '%' || p_city || '%')
     LIMIT 50
  ) c;

  RETURN jsonb_build_object('events', v_cards);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_events(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_events(uuid, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Part 4 — rpc_report_event
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_report_event(
  p_event_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.safe_auth_uid();
  v_child uuid;
  v_report_id uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_event_id IS NULL THEN RAISE EXCEPTION 'event_required'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  SELECT ca.child_id INTO v_child FROM public.child_access ca
   WHERE ca.user_id = v_caller AND ca.role = 'child' AND ca.status = 'active'
   LIMIT 1;
  IF v_child IS NULL THEN RAISE EXCEPTION 'teen_only'; END IF;

  INSERT INTO public.event_reports (event_id, reporter_child_id, reason)
  VALUES (p_event_id, v_child, btrim(p_reason))
  RETURNING id INTO v_report_id;

  UPDATE public.events
     SET report_count = report_count + 1
   WHERE id = p_event_id;

  RETURN v_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_report_event(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_report_event(uuid, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. Insert with host_type='house_party' -> CHECK violation.
-- 2. Insert with is_private_residence=true -> CHECK violation.
-- 3. 13-15 listing excludes 18+/21+ rows entirely.
-- 4. Report flow increments report_count.
-- 5. check.sh passes.
