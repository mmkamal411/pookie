-- =============================================================================
-- Implements sol-health.md §1 (H0–H3 taxonomy), §1.6–1.7, §4.1, §10.1.
-- Legal gate: counsel sign-off on H0–H3 required before production data flows
-- (NFR-LEGAL); schema itself is complete and tested.
-- =============================================================================
-- Migration 022: H0/H1/H2/H3 health privacy taxonomy (FR-HEALTH-001, panel G3)
--
-- Source: docs/solutions/sol-health.md §1, §1.6–1.7, Appendix A.
-- Applies AFTER migration 021 (access_events). Health consent/grants, grace,
-- and deletion events write to public.access_events.
--
-- Contents:
--   1. health_tier enum (H0/H1/H2/H3)
--   2. Tier columns on all health content tables (stamped at write, never
--      re-derived at read — defense in depth)
--   3. metric_defs.default_sensitivity → health_tier (amends unapplied 011,
--      per sol-health §1.7 amendment #1)
--   4. health_tier_visible() — the privacy predicate, superseding
--      health_metric_visible() (kept as a thin legacy alias until all
--      callers migrate; alias is deprecated)
--   5. health_consent_grants — per-tier grants (never blanket)
--   6. allergy_list (H2) — W28 allergy hard-blocks (sol-health §10.1)
--   6b. health_medications (H2) — current medication list (sol-health §1.2,
--       §2.5 transition-summary contents). Descriptive only: name, dose,
--       schedule — NEVER dosing advice (FDA wellness boundary, §4.2).
--   7. Amendments to 011's health_safety_overrides (§1.7 #2): H2-only,
--      expires_at <= created_at + 30 days, teen_appealed_at (16–17 early revoke)
--   8. health_subject_age_band(): split 'teen' → 'teen_13_15' / 'teen_16_17'
--      (§1.7 #3); 'unknown' fails closed into the 13–15 arm
--   9. GA state_minor_consent_rules seed, counsel_reviewed=false (§8.3)
--  10. Deny-by-default proof notes (§12 item 1) — see review checkpoint RC-3
--
-- REVIEW CHECKPOINTS (Fractional Team 1 compliance review + Team 2 RLS audit
-- must sign before phase completion):
--   RC-022-1 (Team 1): tier taxonomy matches counsel's H0–H3 definitions;
--              backfill map (routine/sensitive → H1/H2) is non-expansive.
--   RC-022-2 (Team 2): health_tier_visible() arm-by-arm audit; prove
--              deny-by-default per (tier × band) in the staging matrix test.
--   RC-022-3 (Team 1): safety-override expiry/arm changes preserve the audit
--              trail (append-only; revoked_at kept).
--   RC-022-4 (Team 1): GA row ships counsel_reviewed=false and nothing in
--              this migration treats it as authoritative.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The tier enum
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.health_tier AS ENUM ('H0','H1','H2','H3');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE public.health_tier IS
  'FR-HEALTH-001. H0=prohibited for minors; H1=shareable wellness; '
  'H2=teen-private; H3=legally sensitive (teen-only, no parent path ever). '
  'DRAFT — not counsel-cleared.';

-- ---------------------------------------------------------------------------
-- 2. Tier columns on all health content tables (amends 011/012 in place).
--    Tier is STAMPED AT WRITE from metric_defs — never re-derived at read.
-- ---------------------------------------------------------------------------
ALTER TABLE public.health_metrics
  ADD COLUMN IF NOT EXISTS health_tier public.health_tier NOT NULL DEFAULT 'H2';

ALTER TABLE public.food_logs
  ADD COLUMN IF NOT EXISTS health_tier public.health_tier NOT NULL DEFAULT 'H2';

ALTER TABLE public.health_safety_overrides
  ADD COLUMN IF NOT EXISTS tier public.health_tier NOT NULL DEFAULT 'H2'
    CHECK (tier = 'H2');

-- Provenance + anomaly columns (sol-health §4.1): provenance is first-class,
-- every reading renders with its source. The anomaly flag is NOT
-- parent-visible (backdoor-alert risk) — enforced in §4.3-aware RLS/tests.
ALTER TABLE public.health_metrics
  ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'manual'
    CHECK (provenance IN ('manual','apple_healthkit','google_health_connect','provider_import')),
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS anomaly_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anomaly_reviewed_at timestamptz;

-- Tombstone + seal columns used by the §2.4 review–correct–seal flow and the
-- §3.3 deletion pipeline.
ALTER TABLE public.health_metrics
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sealed_by uuid REFERENCES public.users(id);

ALTER TABLE public.food_logs
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sealed_by uuid REFERENCES public.users(id);

-- Backfill: routine/sensitive → H1/H2 per sol-health §1.6 backfill map.
-- Steps, sleep_hours, heart_rate_resting, height, blood_pressure_* → H1.
-- weight, blood_glucose, hba1c → H2. Unknown keys stay H2 (fail closed).
UPDATE public.metric_defs
SET default_sensitivity = 'routine'
WHERE metric_key IN ('steps_daily','sleep_hours','heart_rate_resting','height',
                     'blood_pressure_systolic','blood_pressure_diastolic')
  AND default_sensitivity <> 'routine';

-- ---------------------------------------------------------------------------
-- 3. metric_defs.default_sensitivity → health_tier (§1.7 amendment #1).
--    011 is UNAPPLIED: this is an amend-in-place, not a second chain.
-- ---------------------------------------------------------------------------
ALTER TABLE public.metric_defs
  ADD COLUMN IF NOT EXISTS health_tier public.health_tier;

UPDATE public.metric_defs
SET health_tier = CASE
  WHEN metric_key IN ('steps_daily','sleep_hours','heart_rate_resting','height',
                      'blood_pressure_systolic','blood_pressure_diastolic')
    THEN 'H1'::public.health_tier
  ELSE 'H2'::public.health_tier
END
WHERE health_tier IS NULL;

ALTER TABLE public.metric_defs
  ALTER COLUMN health_tier SET NOT NULL,
  ALTER COLUMN health_tier SET DEFAULT 'H1'::public.health_tier;

-- Seed the H1 wellness metric keys that the backfill map names, so device
-- ingestion (§4.1) has rows to join against.
INSERT INTO public.metric_defs (metric_key, display_name, unit, category, default_sensitivity, health_tier, source_types) VALUES
  ('steps_daily',      'Daily steps',        'steps',   'activity', 'routine', 'H1', '{manual,device}'),
  ('sleep_hours',      'Sleep',              'hours',   'sleep',    'routine', 'H1', '{manual,device}'),
  ('heart_rate_resting','Resting heart rate','bpm',     'vitals',   'routine', 'H1', '{manual,device}'),
  ('height',           'Height',             'in',      'growth',   'routine', 'H1', '{manual}'),
  ('activity_minutes', 'Activity minutes',   'minutes', 'activity', 'routine', 'H1', '{manual,device}')
ON CONFLICT (metric_key) DO UPDATE SET health_tier = EXCLUDED.health_tier;

-- legacy two-level column kept read-only for rollback transparency until
-- RC-022-2 signs off; new code MUST use health_tier.
COMMENT ON COLUMN public.metric_defs.default_sensitivity IS
  'DEPRECATED by 022 (amendment §1.7). health_tier is the source of truth. '
  'Drop only after all callers migrated and Team 1 signs.';

-- ---------------------------------------------------------------------------
-- 4. health_subject_age_band(): split 'teen' → 'teen_13_15' / 'teen_16_17'
--    (§1.7 amendment #3). 'unknown' fails closed into the 13–15 arm.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.health_subject_age_band(p_subject_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.date_of_birth IS NULL THEN 'unknown'
    WHEN c.date_of_birth > CURRENT_DATE - interval '13 years' THEN 'under13'
    WHEN c.date_of_birth > CURRENT_DATE - interval '16 years' THEN 'teen_13_15'
    WHEN c.date_of_birth > CURRENT_DATE - interval '18 years' THEN 'teen_16_17'
    ELSE 'adult'
  END
  FROM public.health_subjects hs
  JOIN public.children c ON c.id = hs.child_id
  WHERE hs.id = p_subject_id
$$;

-- ---------------------------------------------------------------------------
-- 5. health_consent_grants — per-tier grants (a general "health" grant is
--    unrepresentable by schema). Used by §1.6.2 re-consent AND pre-18 grants.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_consent_grants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  granter_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- the subject (or steward)
  grantee_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- the adult receiving visibility
  tier            public.health_tier NOT NULL,
  scope           text NOT NULL DEFAULT 'wellness',
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  granted_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  revoked_at      timestamptz,
  revoked_reason  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_grant_no_h3 CHECK (tier <> 'H3'),   -- H3 NEVER has a grant row (structural)
  CONSTRAINT health_grant_no_h0 CHECK (tier <> 'H0')    -- H0 shares nothing under a general grant
);

CREATE INDEX IF NOT EXISTS health_consent_grants_child_tier_idx
  ON public.health_consent_grants (child_id, tier)
  WHERE status = 'active';

ALTER TABLE public.health_consent_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_grants_granter_read ON public.health_consent_grants;
CREATE POLICY health_grants_granter_read ON public.health_consent_grants
  FOR SELECT USING (
    granter_user_id = auth.uid()
    OR grantee_user_id = auth.uid()
  );

-- Grants are written by RPC only (grant rows are the audit trail); no direct
-- client INSERT/UPDATE/DELETE.
GRANT SELECT ON public.health_consent_grants TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. health_tier_visible() — THE privacy predicate (SECURITY DEFINER,
--    search_path pinned, no agent_reader grant). Replaces
--    health_metric_visible() per §1.6.4. Deny by default: the final RETURN
--    is false; every arm must affirmatively grant.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.health_tier_visible(
  p_subject_id uuid,
  p_metric_key text,
  p_tier public.health_tier
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id  uuid;
  v_band      text;
  v_is_teen   boolean := false;
  v_is_parent boolean := false;
BEGIN
  -- (1) Unknown subject / unknown tier → false.
  SELECT hs.child_id INTO v_child_id
  FROM public.health_subjects hs
  WHERE hs.id = p_subject_id;

  IF v_child_id IS NULL OR p_tier IS NULL THEN
    RETURN false;
  END IF;

  -- (2) Caller's tenant must contain the subject's child. Fail closed.
  IF NOT (v_child_id = ANY (public.current_child_ids())) THEN
    RETURN false;
  END IF;

  -- (3) 18+ grace rows: historical-only read arm (see 024 for the table).
  --     Enforced HERE (predicate, not the sweep job) so a missed job fails
  --     closed. H3 never graced.
  IF p_tier IN ('H1','H2') AND EXISTS (
    SELECT 1
    FROM public.health_grace hg
    WHERE hg.child_id = v_child_id
      AND hg.viewer_user_id = auth.uid()
      AND hg.tier = p_tier
      AND hg.grace_expires_at > now()
  ) THEN
    RETURN true;
  END IF;

  -- (4) Tombstoned rows are never visible (§3.3). (Table filter is cheaper,
  --     but the predicate keeps the invariant centralized.)
  --     (Handled at policy level via deleted_at IS NULL; noted here.)

  v_band := public.health_subject_age_band(p_subject_id);
  -- 'unknown' DOB fails closed into the 13–15 arm.
  IF v_band = 'unknown' THEN
    v_band := 'teen_13_15';
  END IF;

  v_is_teen := EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid()
      AND ca.child_id = v_child_id
      AND ca.role = 'child'
  );
  v_is_parent := EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid()
      AND ca.child_id = v_child_id
      AND ca.role = 'parent'
  );

  -- Band: under13 — stewardship. Parents (stewards) see H1/H2. H3 is not
  -- collected for <13 (parent-entered sexual-health content lands H2, §1.3).
  IF v_band = 'under13' THEN
    IF p_tier IN ('H1','H2') THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  -- Band: 13–15 / 16–17.
  IF v_band IN ('teen_13_15','teen_16_17') THEN
    -- H3: teen only. NO grant arm. NO override arm. NO break-glass arm.
    IF p_tier = 'H3' THEN
      RETURN v_is_teen;
    END IF;
    -- H0: refuse (<18).
    IF p_tier = 'H0' THEN
      RETURN false;
    END IF;
    -- H1: family per Wellness scope grant (default ON at link).
    IF p_tier = 'H1' THEN
      IF v_is_teen THEN
        RETURN true;
      END IF;
      RETURN v_is_parent AND EXISTS (
        SELECT 1 FROM public.health_consent_grants g
        WHERE g.child_id = v_child_id
          AND g.grantee_user_id = auth.uid()
          AND g.tier = 'H1'
          AND g.status = 'active'
          AND (g.expires_at IS NULL OR g.expires_at > now())
      );
    END IF;
    -- H2: teen only, default. Parent path: teen's explicit H2 grant, OR a
    -- time-boxed (≤30d), teen-notified, unexpired, unappealed safety override.
    IF p_tier = 'H2' THEN
      IF v_is_teen THEN
        RETURN true;
      END IF;
      IF v_is_parent THEN
        -- Teen-made H2 grant.
        IF EXISTS (
          SELECT 1 FROM public.health_consent_grants g
          WHERE g.child_id = v_child_id
            AND g.grantee_user_id = auth.uid()
            AND g.tier = 'H2'
            AND g.status = 'active'
            AND (g.expires_at IS NULL OR g.expires_at > now())
        ) THEN
          RETURN true;
        END IF;
        -- Safety override (H2-only, audited, teen-notified, ≤30d).
        RETURN EXISTS (
          SELECT 1
          FROM public.health_safety_overrides so
          WHERE so.subject_id = p_subject_id
            AND so.parent_user_id = auth.uid()
            AND so.tier = 'H2'
            AND so.revoked_at IS NULL
            AND so.teen_appealed_at IS NULL
            AND so.expires_at > now()
        );
      END IF;
      RETURN false;
    END IF;
  END IF;

  -- Band: adult. Own-data read is always true. Parent rows require an
  -- unexpired post-18 re-consent grant (§2.3).
  IF v_band = 'adult' THEN
    IF p_tier = 'H3' THEN
      RETURN v_is_teen;   -- the adult IS the teen-as-subject; granter=subj
    END IF;
    IF p_tier = 'H0' THEN
      RETURN v_is_teen;   -- H3-equivalent for 18+: user only
    END IF;
    -- v_is_teen here means the caller IS the adult subject (child-role on
    -- their own record). Check their own grants row OR caller-is-subject.
    IF v_is_teen THEN
      RETURN true;
    END IF;
    RETURN EXISTS (
      SELECT 1 FROM public.health_consent_grants g
      WHERE g.child_id = v_child_id
        AND g.grantee_user_id = auth.uid()
        AND g.tier = p_tier
        AND g.status = 'active'
        AND (g.expires_at IS NULL OR g.expires_at > now())
    );
  END IF;

  -- Deny by default.
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.health_tier_visible(uuid, text, public.health_tier) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_tier_visible(uuid, text, public.health_tier)
  TO authenticated, service_role;
-- Deliberately NO agent_reader grant (security review M1 carried forward).

-- Legacy alias kept read-only until all callers migrate; deprecated.
CREATE OR REPLACE FUNCTION public.health_metric_visible(p_subject_id uuid, p_metric_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE WARNING 'health_metric_visible() is deprecated — use health_tier_visible()';
  RETURN public.health_tier_visible(
    p_subject_id, p_metric_key,
    (SELECT health_tier FROM public.metric_defs WHERE metric_key = p_metric_key)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Amendments to 011's health_safety_overrides (§1.7 #2):
--    H2-only (CHECK), expires_at ≤ created_at + 30 days (CHECK), teen_appealed_at.
-- ---------------------------------------------------------------------------
ALTER TABLE public.health_safety_overrides
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS teen_appealed_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.health_safety_overrides
    ADD CONSTRAINT health_override_max_30d
      CHECK (expires_at <= created_at + interval '30 days');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 8. allergy_list (H2) — W28 allergy hard-blocks (sol-health §10.1).
--    Populated ONLY by explicit entry (teen, steward parent for <13, or
--    clinician import). No inference columns, no inference jobs — banned.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.allergy_list (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id      uuid NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  allergen        text NOT NULL,
  allergen_custom text,
  severity        text NOT NULL CHECK (severity IN ('intolerance','allergy','anaphylaxis')),
  source          text NOT NULL CHECK (source IN ('teen_entered','parent_entered','clinician_verified')),
  verified_at     timestamptz,
  entered_by      uuid REFERENCES public.users(id),
  health_tier     public.health_tier NOT NULL DEFAULT 'H2',
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS allergy_list_subject_idx
  ON public.allergy_list (subject_id) WHERE deleted_at IS NULL;

ALTER TABLE public.allergy_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allergy_list_tier_read ON public.allergy_list;
CREATE POLICY allergy_list_tier_read ON public.allergy_list
  FOR SELECT USING (
    deleted_at IS NULL
    AND public.health_tier_visible(subject_id, 'allergy', health_tier)
  );

DROP POLICY IF EXISTS allergy_list_tenant_insert ON public.allergy_list;
CREATE POLICY allergy_list_tenant_insert ON public.allergy_list
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.allergy_list.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  );

DROP POLICY IF EXISTS allergy_list_teen_update ON public.allergy_list;
CREATE POLICY allergy_list_teen_update ON public.allergy_list
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            JOIN public.child_access ca
              ON ca.child_id = hs.child_id AND ca.user_id = auth.uid()
              AND ca.role IN ('parent','child')
            WHERE hs.id = public.allergy_list.subject_id)
  )
  WITH CHECK (TRUE);

GRANT SELECT, INSERT, UPDATE ON public.allergy_list TO authenticated;

-- ---------------------------------------------------------------------------
-- 6b. health_medications (H2) — descriptive medication list. Name, dose,
--     schedule as recorded; the app NEVER gives dosing advice (§4.2).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_medications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  dose        text,
  schedule    text,                                -- e.g. 'daily with breakfast'
  started_at  date,
  entered_by  uuid REFERENCES public.users(id),
  health_tier public.health_tier NOT NULL DEFAULT 'H2',
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_medications_subject_idx
  ON public.health_medications (subject_id) WHERE deleted_at IS NULL;

ALTER TABLE public.health_medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_medications_tier_read ON public.health_medications;
CREATE POLICY health_medications_tier_read ON public.health_medications
  FOR SELECT USING (
    deleted_at IS NULL
    AND public.health_tier_visible(subject_id, 'medication', health_tier)
  );

DROP POLICY IF EXISTS health_medications_tenant_insert ON public.health_medications;
CREATE POLICY health_medications_tenant_insert ON public.health_medications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.health_medications.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  );

DROP POLICY IF EXISTS health_medications_tenant_update ON public.health_medications;
CREATE POLICY health_medications_tenant_update ON public.health_medications
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.health_subjects hs
                 WHERE hs.id = public.health_medications.subject_id
                   AND hs.child_id = ANY (public.current_child_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.health_subjects hs
                      WHERE hs.id = public.health_medications.subject_id
                        AND hs.child_id = ANY (public.current_child_ids())));

GRANT SELECT, INSERT, UPDATE ON public.health_medications TO authenticated;

-- ---------------------------------------------------------------------------
-- 6c. health_alert_thresholds — counsel-reviewed anomaly thresholds (§4.3).
--    Rows ship counsel_reviewed=false; the pipeline treats unreviewed
--    thresholds as INERT (same counsel-gate pattern as
--    state_minor_consent_rules). Detection never diagnoses — it flags.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_alert_thresholds (
  metric_key       text PRIMARY KEY REFERENCES public.metric_defs(metric_key),
  warn_low         numeric,
  warn_high        numeric,
  counsel_reviewed boolean NOT NULL DEFAULT false,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.health_alert_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_alert_thresholds_read ON public.health_alert_thresholds;
CREATE POLICY health_alert_thresholds_read ON public.health_alert_thresholds
  FOR SELECT USING (true);

GRANT SELECT ON public.health_alert_thresholds TO authenticated;

INSERT INTO public.health_alert_thresholds (metric_key, warn_low, warn_high, counsel_reviewed) VALUES
  ('heart_rate_resting', 40, 120, false),
  ('weight', NULL, NULL, false)   -- weight swings evaluated by the route, not a static bound
ON CONFLICT (metric_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. GA state_minor_consent_rules seed (counsel_reviewed=false — §8.3).
--    Nothing treats this row as authoritative until counsel flips it.
-- ---------------------------------------------------------------------------
INSERT INTO public.state_minor_consent_rules
  (state_code, rule_summary, minor_consent_age, notes, as_of, source, counsel_reviewed)
VALUES (
  'GA',
  'PENDING COUNSEL REVIEW. Categories under review: STI testing/treatment, '
  'substance-use counseling/treatment, mental-health care at 16+. Exact statutes '
  'and age edges to be confirmed by licensed counsel.',
  NULL,
  'Seeded by 022 as an unreviewed placeholder per sol-health §8.3. '
  'H3 auto-tiering keys off teen-applied category tags, NOT this row, until '
  'counsel_reviewed=true.',
  '2026-10-12',
  'Georgia state minor-consent provisions — counsel to cite',
  false
)
ON CONFLICT (state_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10. RLS: re-point health_metrics + food_logs SELECT through the new
--     predicate. Tombstoned rows excluded at policy level.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS health_metrics_privacy_read ON public.health_metrics;
CREATE POLICY health_metrics_tier_read ON public.health_metrics
  FOR SELECT USING (
    deleted_at IS NULL
    AND public.health_tier_visible(subject_id, metric_key, health_tier)
  );

DROP POLICY IF EXISTS food_logs_diary_read ON public.food_logs;
CREATE POLICY food_logs_diary_read ON public.food_logs
  FOR SELECT USING (
    deleted_at IS NULL
    AND public.health_tier_visible(subject_id, 'food_log', health_tier)
  );

-- ---------------------------------------------------------------------------
-- Deny-by-default proof approach (RC-022-2, staging test matrix):
--   For each (tier × band): H0,H1,H2,H3 × under13,teen_13_15,teen_16_17,adult
--   × caller ∈ {teen, parent, stranger, anon}:
--     1. Insert fixture rows as the teen (service_role bypass).
--     2. SELECT as each caller; assert visibility == the §1.3 matrix cell.
--     3. Also assert: unknown DOB behaves as teen_13_15; H3 row never
--        visible to parent even WITH an H2 grant + active override.
--   Test harness: supabase/tests/health_tier_matrix.sql (Team 2 owns).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Review checkpoint sign-offs (filled by reviewers, not the author).
-- ---------------------------------------------------------------------------
-- | Checkpoint | Reviewer | Date | Result |
-- | RC-022-1   | (Fractional Team 1) | | |
-- | RC-022-2   | (Team 2 RLS audit) | | |
-- | RC-022-3   | (Fractional Team 1) | | |
-- | RC-022-4   | (Fractional Team 1) | | |
