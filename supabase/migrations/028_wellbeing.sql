-- DRAFT — DO NOT APPLY until counsel clears H0–H3 (NFR-LEGAL gate).
-- =============================================================================
-- Implements sol-health.md §5 (W8 wellbeing data side), Appendix A.
-- Depends on 022 (tiers), 024 (tombstones, grace).
-- Legal gate: counsel sign-off on H0–H3 required before production data flows
-- (NFR-LEGAL); schema itself is complete and tested.
-- =============================================================================
-- Migration 025: wellbeing entries + crisis-event emission (data side only)
--
-- W8 emits EVENTS; it does not act on them. The safety designer owns the
-- response ladder (988 surfacing, trusted-adult routing). Every emission
-- carries teen identity + event type + timestamp + severity — NEVER content,
-- scores, journal text, or metric values. Safety events never widen data
-- access (C4 firewall).
--
-- Contents:
--   1. wellbeing_entries — H2 minimum; H3 when the teen marks the entry as
--      relating to mental-health care / self-harm / disordered eating.
--      Teen-only RLS: no parent arm, no override arm, no aggregate endpoint.
--   2. wellbeing_events — metadata-only event table (feeds the safety
--      pipeline): (child_id, event_type, severity, created_at).
--   3. emit_wellbeing_event() — the single emission point.
--   4. detect_wellbeing_pattern() — server-side pattern detection
--      (3+ lowest-band days; 7-day deteriorating trend) returning the FLAG
--      only (SECURITY DEFINER; no content leaves).
--   5. purge_expired_wellbeing() — nightly: 12mo rolling journal_text,
--      mood scores/tags 24mo, teen-configurable auto-purge honoring.
--   6. NEDA resource rows are client-side copy (not schema); ed_signal
--      emission is wired here.
--
-- REVIEW CHECKPOINTS:
--   RC-025-1 (Team 1): no parent aggregate RPC exists for wellbeing; any
--              future one requires a new migration + panel re-review.
--   RC-025-2 (Team 2): teen-only RLS proven in the matrix test, incl.
--              service_role product-code read path absent.
--   RC-025-3 (Team 1): event payloads contain zero health content; keyword
--              assist requires teen confirm before H3 classification.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. wellbeing_entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wellbeing_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  entered_at  timestamptz NOT NULL DEFAULT now(),
  mood_score  smallint CHECK (mood_score BETWEEN 1 AND 5),  -- 1 = crisis-level band
  mood_label  text,
  journal_text text,
  tags        text[] NOT NULL DEFAULT '{}',
  care_category text CHECK (care_category IN
                ('mental_health_care','self_harm','disordered_eating','none')),
  health_tier public.health_tier NOT NULL DEFAULT 'H2',
  entered_by  uuid REFERENCES public.users(id),
  auto_purge_after_days int CHECK (auto_purge_after_days IN (30,90,365)),
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wellbeing_entries_child_entered_idx
  ON public.wellbeing_entries (child_id, entered_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.wellbeing_entries ENABLE ROW LEVEL SECURITY;

-- THE strongest RLS in the health surface: teen only. No parent arm, no
-- override arm, no grant arm, no break-glass arm.
DROP POLICY IF EXISTS wellbeing_teen_only_read ON public.wellbeing_entries;
CREATE POLICY wellbeing_teen_only_read ON public.wellbeing_entries
  FOR SELECT USING (
    deleted_at IS NULL
    AND child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.wellbeing_entries.child_id
                  AND ca.role = 'child')
  );

DROP POLICY IF EXISTS wellbeing_teen_only_insert ON public.wellbeing_entries;
CREATE POLICY wellbeing_teen_only_insert ON public.wellbeing_entries
  FOR INSERT WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND entered_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.wellbeing_entries.child_id
                  AND ca.role = 'child')
    -- H3 is teen-entered consentable care: a parent can never INSERT an H3 row
    -- about the teen (h3_parent_write_refusal, §8.1). enforced here.
    AND (health_tier <> 'H3' OR entered_by = auth.uid())
  );

DROP POLICY IF EXISTS wellbeing_teen_only_update ON public.wellbeing_entries;
CREATE POLICY wellbeing_teen_only_update ON public.wellbeing_entries
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.wellbeing_entries.child_id
                  AND ca.role = 'child')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.user_id = auth.uid()
              AND ca.child_id = public.wellbeing_entries.child_id
              AND ca.role = 'child')
  );

DROP POLICY IF EXISTS wellbeing_teen_only_delete ON public.wellbeing_entries;
CREATE POLICY wellbeing_teen_only_delete ON public.wellbeing_entries
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.user_id = auth.uid()
              AND ca.child_id = public.wellbeing_entries.child_id
              AND ca.role = 'child')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellbeing_entries TO authenticated;

-- care_category → H3 enforcement at write: entries the teen marks as
-- mental-health care / self-harm / disordered eating land H3 (server applies
-- H3 regardless; the teen cannot downgrade to H2, §8.1).
CREATE OR REPLACE FUNCTION public.enforce_wellbeing_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.care_category IN ('mental_health_care','self_harm','disordered_eating') THEN
    NEW.health_tier := 'H3';
  END IF;
  IF NEW.health_tier = 'H3'
     AND NEW.care_category IS DISTINCT FROM 'mental_health_care'
     AND NEW.care_category IS DISTINCT FROM 'self_harm'
     AND NEW.care_category IS DISTINCT FROM 'disordered_eating' THEN
    -- Teen may also explicitly tier H3; server keeps it H3 (no downgrade).
    NEW.health_tier := 'H3';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_wellbeing_tier ON public.wellbeing_entries;
CREATE TRIGGER trg_enforce_wellbeing_tier
  BEFORE INSERT OR UPDATE OF care_category, health_tier ON public.wellbeing_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_wellbeing_tier();

-- ---------------------------------------------------------------------------
-- 2. wellbeing_events — metadata ONLY. No content, no scores, no text.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wellbeing_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN
               ('mood_critical','pattern_flag','self_harm_disclosure',
                'ed_signal','health_anomaly_flag')),
  severity   text NOT NULL CHECK (severity IN ('low','medium','high')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wellbeing_events_child_created_idx
  ON public.wellbeing_events (child_id, created_at DESC);

ALTER TABLE public.wellbeing_events ENABLE ROW LEVEL SECURITY;

-- Events are readable by the teen and by the safety pipeline (service_role).
-- They are NEVER readable by parents: metadata-only emission does not create
-- a parent-visible surface (C4 firewall).
DROP POLICY IF EXISTS wellbeing_events_teen_read ON public.wellbeing_events;
CREATE POLICY wellbeing_events_teen_read ON public.wellbeing_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.user_id = auth.uid()
              AND ca.child_id = public.wellbeing_events.child_id
              AND ca.role = 'child')
  );

-- No client INSERT: events are emitted server-side via emit_wellbeing_event().
GRANT SELECT ON public.wellbeing_events TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. emit_wellbeing_event() — the single emission point.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_wellbeing_event(
  p_child_id uuid,
  p_event_type text,
  p_severity text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_event_type NOT IN ('mood_critical','pattern_flag','self_harm_disclosure',
                          'ed_signal','health_anomaly_flag') THEN
    RAISE EXCEPTION 'wellbeing_event_type_refused: %', p_event_type;
  END IF;
  IF p_severity NOT IN ('low','medium','high') THEN
    RAISE EXCEPTION 'wellbeing_event_severity_refused: %', p_severity;
  END IF;

  INSERT INTO public.wellbeing_events (child_id, event_type, severity)
  VALUES (p_child_id, p_event_type, p_severity)
  RETURNING id INTO v_id;

  -- Notify the safety pipeline (owned by the safety designer). The payload
  -- carries type + severity + teen identity only — never content.
  PERFORM pg_notify(
    'wellbeing_event',
    jsonb_build_object('event_id', v_id, 'child_id', p_child_id,
                       'event_type', p_event_type, 'severity', p_severity,
                       'at', now())::text
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_wellbeing_event(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emit_wellbeing_event(uuid, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. detect_wellbeing_pattern() — server-side pattern detection returning
--    the FLAG only. SECURITY DEFINER; no mood history leaves the function.
--    Emits 'pattern_flag' (medium) when: 3+ consecutive lowest-band days,
--    or a 7-day deteriorating trend.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.detect_wellbeing_pattern(p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_low_streak int := 0;
  v_first_avg  numeric;
  v_last_avg   numeric;
  v_fired      boolean := false;
BEGIN
  -- 3+ consecutive days of lowest-band mood (score = 1).
  WITH daily AS (
    SELECT date_trunc('day', entered_at)::date AS d,
           min(mood_score) AS worst
    FROM public.wellbeing_entries
    WHERE child_id = p_child_id AND deleted_at IS NULL
      AND entered_at >= now() - interval '14 days'
    GROUP BY 1
  ),
  streaks AS (
    SELECT d, worst,
           d - (row_number() OVER (ORDER BY d))::int AS grp
    FROM daily WHERE worst = 1
  )
  SELECT coalesce(max(cnt), 0) INTO v_low_streak
  FROM (SELECT grp, count(*) AS cnt FROM streaks GROUP BY grp) s;

  -- 7-day deteriorating trend: first-3-day avg vs last-3-day avg.
  WITH daily AS (
    SELECT date_trunc('day', entered_at)::date AS d,
           avg(mood_score)::numeric AS avg_m
    FROM public.wellbeing_entries
    WHERE child_id = p_child_id AND deleted_at IS NULL
      AND entered_at >= now() - interval '7 days'
    GROUP BY 1 ORDER BY 1
  )
  SELECT (SELECT avg(avg_m) FROM (SELECT avg_m FROM daily ORDER BY d LIMIT 3) a),
         (SELECT avg(avg_m) FROM (SELECT avg_m FROM daily ORDER BY d DESC LIMIT 3) b)
  INTO v_first_avg, v_last_avg;

  IF v_low_streak >= 3
     OR (v_first_avg IS NOT NULL AND v_last_avg IS NOT NULL
         AND v_first_avg - v_last_avg >= 2) THEN
    PERFORM public.emit_wellbeing_event(p_child_id, 'pattern_flag', 'medium');
    v_fired := true;
  END IF;

  -- Return metadata only — never the scores.
  RETURN jsonb_build_object('pattern_flag', v_fired, 'checked_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.detect_wellbeing_pattern(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_wellbeing_pattern(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. purge_expired_wellbeing() — nightly.
--    journal_text: 12-month rolling default (per-entry auto_purge_after_days
--    wins when set). Mood scores/tags: 24 months. H3 entries: journal nulled
--    at tombstone (§3.3 H3 fast path).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_wellbeing()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journal int := 0;
  v_scores  int := 0;
BEGIN
  -- Per-entry auto-purge (teen setting) wins.
  UPDATE public.wellbeing_entries
  SET deleted_at = now(), journal_text = NULL
  WHERE deleted_at IS NULL
    AND auto_purge_after_days IS NOT NULL
    AND entered_at < now() - (auto_purge_after_days || ' days')::interval;
  GET DIAGNOSTICS v_journal = ROW_COUNT;

  -- Default 12-month rolling retention on journal_text: null the text but
  -- keep the mood score/tag row for the teen's own 24-month trends.
  UPDATE public.wellbeing_entries
  SET journal_text = NULL
  WHERE deleted_at IS NULL
    AND auto_purge_after_days IS NULL
    AND journal_text IS NOT NULL
    AND entered_at < now() - interval '12 months';
  GET DIAGNOSTICS v_journal = v_journal + ROW_COUNT;

  -- Mood scores/tags: 24 months, then tombstone the row.
  UPDATE public.wellbeing_entries
  SET deleted_at = now(), journal_text = NULL
  WHERE deleted_at IS NULL
    AND entered_at < now() - interval '24 months';
  GET DIAGNOSTICS v_scores = ROW_COUNT;

  RETURN jsonb_build_object('journals_purged', v_journal,
                            'score_rows_tombstoned', v_scores,
                            'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_wellbeing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_wellbeing() TO service_role;

DO $$
BEGIN
  PERFORM cron.schedule('purge_expired_wellbeing', '0 2 * * *',
    $cron$SELECT public.purge_expired_wellbeing()$cron$);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Nightly pattern check across teens with recent entries.
DO $$
BEGIN
  PERFORM cron.schedule('nightly_wellbeing_pattern_check', '30 2 * * *',
    $cron$SELECT public.detect_wellbeing_pattern(w.child_id)
      FROM (SELECT DISTINCT child_id FROM public.wellbeing_entries
            WHERE entered_at >= now() - interval '14 days'
              AND deleted_at IS NULL) w$cron$);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Review checkpoint sign-offs.
-- ---------------------------------------------------------------------------
-- | Checkpoint | Reviewer | Date | Result |
-- | RC-025-1   | (Fractional Team 1) | | |
-- | RC-025-2   | (Team 2 RLS audit) | | |
-- | RC-025-3   | (Fractional Team 1) | | |
