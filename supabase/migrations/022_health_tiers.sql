-- DRAFT — DO NOT APPLY until counsel clears H0–H3 (NFR-LEGAL gate).
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
--   3. metric_defs health_tier backfill guard (011 was amended in place per
--      §1.7: default_sensitivity no longer exists; this section only seeds
--      activity_minutes and repairs the 011-seeded tiers idempotently)
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

-- Stamp the tier at write from metric_defs (defense in depth: the tier is
-- stamped, never re-derived at read). Unconditional overwrite — a client
-- cannot smuggle a wider tier past the WITH CHECK policy.
CREATE OR REPLACE FUNCTION public.stamp_health_tier_from_def()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  SELECT md.health_tier INTO NEW.health_tier
  FROM public.metric_defs md
  WHERE md.metric_key = NEW.metric_key;
  IF NEW.health_tier IS NULL THEN
    RAISE EXCEPTION 'health_unknown_metric_key';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS health_metrics_stamp_tier ON public.health_metrics;
CREATE TRIGGER health_metrics_stamp_tier
  BEFORE INSERT ON public.health_metrics
  FOR EACH ROW EXECUTE FUNCTION public.stamp_health_tier_from_def();

REVOKE ALL ON FUNCTION public.stamp_health_tier_from_def() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stamp_health_tier_from_def() TO authenticated, service_role;

ALTER TABLE public.food_logs
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sealed_by uuid REFERENCES public.users(id);

-- ---------------------------------------------------------------------------
-- 3. metric_defs health_tier backfill guard (§1.7 amendment #1 was applied
--    edit-in-place in 011: default_sensitivity no longer exists there).
--    This section is idempotent repair only.
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
-- ingestion (§4.1) has rows to join against. (011's seed already carries
-- health_tier; this only adds activity_minutes, which 011 did not seed.
-- RECONCILED 2026-10-12: the default_sensitivity column was removed by the
-- 011 edit-in-place amendment — the old INSERT/COMMENT referencing it would
-- fail at apply and has been removed.)
INSERT INTO public.metric_defs (metric_key, display_name, unit, category, health_tier, source_types) VALUES
  ('activity_minutes', 'Activity minutes',   'minutes', 'activity', 'H1', '{manual,device}')
ON CONFLICT (metric_key) DO UPDATE SET health_tier = EXCLUDED.health_tier;

-- Emancipated minors take the adult track (G11). Added here (not in the
-- 011 amendment) so the column and the function stay in one migration.
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS is_emancipated boolean NOT NULL DEFAULT false;

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
    WHEN c.is_emancipated THEN 'adult'
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
  CONSTRAINT health_grant_no_h0 CHECK (tier <> 'H0'),   -- H0 shares nothing under a general grant
  CONSTRAINT health_grant_no_self CHECK (granter_user_id <> grantee_user_id)
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
-- ---------------------------------------------------------------------------
-- 6. health_tier_visible() — THE privacy predicate (SECURITY DEFINER,
--    search_path pinned, no agent_reader grant). Supersedes
--    health_metric_visible() per sol-health §1.6 (011 amended in place;
--    the old function is dropped in 011 and kept here as a deprecated
--    alias until all callers migrate).
--
-- Implements the §1.3 access matrix (tier × age band). Deny by default:
-- the final RETURN is false; every arm must affirmatively grant.
--
-- MERGE NOTE (2026-10-12, Squad 2 reconciliation): this version merges the
-- 011 edit-in-place predicate with the 022 draft. Semantic decisions:
--   (a) H1 teen bands REQUIRE an active Wellness-scope grant row
--       (deny-by-default pure). sol-health §1.3's "default ON at link" is
--       satisfied by the LINK FLOW seeding the row (021 / Platform Team 1
--       seam) — the predicate never invents access. This also satisfies
--       FR-ACCESS-006's stricter "Wellness teen-private" default.
--   (b) H2 grants require granter = the teen (child-role user): "the teen's
--       explicit per-tier grant" (§1.3). A parent cannot grant themselves
--       H2 visibility.
--   (c) Adult band: grant rows must post-date the 18th birthday
--       (granted_at >= 18th birthday). No grandfathering (§2).
--   (d) Safety override stays metric-keyed (011's per-subject+metric
--       design); an override for one metric never opens other H2 metrics.
--   (e) NO grace arm in the predicate: grace is historical-only
--       (recorded_at < revoke_cutoff), which the predicate cannot see.
--       024 adds  OR health_grace_read_allowed(subject_id, tier,
--       recorded_at)  to each content-table policy. An inlined arm here
--       would over-grant new rows during grace (§3.1 violation). H3 is
--       never graced; wellbeing_entries takes no grace arm (§5.1).
--   (f) 'unknown' DOB fails closed into the teen_13_15 arm.
-- entered_by is deliberately NOT consulted: a parent-entered row for a 13+
-- teen does not widen visibility (§1.6.5).
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
  v_child_id   uuid;
  v_band       text;
  v_is_teen    boolean := false;   -- caller is the subject (child-role on the child)
  v_is_parent  boolean := false;
  v_adult_since date;              -- subject's 18th birthday (NULL when DOB unknown)
BEGIN
  -- (1) Unknown subject / unknown tier -> false.
  SELECT hs.child_id INTO v_child_id
  FROM public.health_subjects hs
  WHERE hs.id = p_subject_id;

  IF v_child_id IS NULL OR p_tier IS NULL THEN
    RETURN false;
  END IF;

  -- (2) Caller's tenant must contain the subject's child. Fail closed.
  -- child_access is the single source of truth; owner_user_id grants nothing.
  IF NOT (v_child_id = ANY (public.current_child_ids())) THEN
    RETURN false;
  END IF;

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

  SELECT (c.date_of_birth + interval '18 years')::date INTO v_adult_since
  FROM public.children c WHERE c.id = v_child_id;

  -- Band: under13 — stewardship. Parents (stewards) see H1/H2. H3 is not
  -- collected for <13 (parent-entered sexual-health content lands H2, §1.3).
  IF v_band = 'under13' THEN
    IF p_tier IN ('H1','H2') THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  -- The subject always sees their own data, every tier, every band.
  IF v_is_teen THEN
    RETURN true;
  END IF;

  -- Band: 13–15 / 16–17.
  IF v_band IN ('teen_13_15','teen_16_17') THEN
    -- H3: teen only. NO grant arm. NO override arm. NO break-glass arm.
    IF p_tier = 'H3' THEN
      RETURN false;  -- v_is_teen already returned true above
    END IF;
    -- H0: refuse (<18).
    IF p_tier = 'H0' THEN
      RETURN false;
    END IF;
    -- H1: family per Wellness-scope grant. The grant row must exist and be
    -- active (decision (a) above); the link flow seeds default-ON rows.
    IF p_tier = 'H1' THEN
      RETURN v_is_parent AND EXISTS (
        SELECT 1 FROM public.health_consent_grants g
        WHERE g.child_id = v_child_id
          AND g.grantee_user_id = auth.uid()
          AND g.tier = 'H1'
          AND g.status = 'active'
          AND (g.expires_at IS NULL OR g.expires_at > now())
      );
    END IF;
    -- H2: teen only, default. Parent path: the teen's explicit H2 grant
    -- (granter must be the teen — decision (b)), OR a time-boxed (<=30d),
    -- teen-notified, unexpired, unappealed H2 safety override, metric-keyed
    -- (decision (d)).
    IF p_tier = 'H2' THEN
      IF v_is_parent THEN
        IF EXISTS (
          SELECT 1
          FROM public.health_consent_grants g
          JOIN public.child_access teen
            ON teen.child_id = g.child_id AND teen.role = 'child'
          WHERE g.child_id = v_child_id
            AND g.grantee_user_id = auth.uid()
            AND g.tier = 'H2'
            AND g.status = 'active'
            AND g.granter_user_id = teen.user_id
            AND (g.expires_at IS NULL OR g.expires_at > now())
        ) THEN
          RETURN true;
        END IF;
        RETURN EXISTS (
          SELECT 1
          FROM public.health_safety_overrides so
          WHERE so.subject_id = p_subject_id
            AND so.metric_key = p_metric_key
            AND so.parent_user_id = auth.uid()
            AND so.tier = 'H2'
            AND so.revoked_at IS NULL
            AND so.teen_appealed_at IS NULL
            AND so.expires_at > now()
            AND so.teen_notified_at IS NOT NULL
        );
      END IF;
      RETURN false;
    END IF;
  END IF;

  -- Band: adult. Own-data read already returned true above (v_is_teen).
  -- Parents need an active POST-18 per-tier re-consent grant: affirmative
  -- opt-in, skip = private, no grandfathering (decision (c)).
  IF v_band = 'adult' THEN
    IF p_tier IN ('H3','H0') THEN
      RETURN false;  -- subject-only; v_is_teen already handled
    END IF;
    RETURN v_is_parent AND v_adult_since IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.health_consent_grants g
      JOIN public.child_access teen
        ON teen.child_id = g.child_id AND teen.role = 'child'
      WHERE g.child_id = v_child_id
        AND g.grantee_user_id = auth.uid()
        AND g.tier = p_tier
        AND g.status = 'active'
        AND g.granter_user_id = teen.user_id
        AND (g.expires_at IS NULL OR g.expires_at > now())
        AND g.granted_at >= v_adult_since
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
-- 7. (REMOVED 2026-10-12 — reconciled: the 011 edit-in-place amendment
--    already added tier/expires_at/teen_appealed_at + the ≤30-day CHECK.
--    Keeping this ALTER block would add a redundant duplicate constraint.)

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
    health_tier = 'H2'   -- allergies are H2, never H1
    AND EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.allergy_list.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  );

DROP POLICY IF EXISTS allergy_list_teen_delete ON public.allergy_list;
CREATE POLICY allergy_list_teen_delete ON public.allergy_list
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.health_subjects hs
      JOIN public.child_access ca ON ca.child_id = hs.child_id
      WHERE hs.id = allergy_list.subject_id
        AND ca.user_id = auth.uid()
        AND (
          ca.role = 'child'
          OR (ca.role = 'parent' AND public.health_subject_age_band(hs.id) = 'under13')
        )
    )
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
  WITH CHECK (
    health_tier = 'H2'
    AND EXISTS (SELECT 1 FROM public.health_subjects hs
                WHERE hs.id = public.allergy_list.subject_id
                  AND hs.child_id = ANY (public.current_child_ids()))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.allergy_list TO authenticated;

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

DROP POLICY IF EXISTS health_medications_teen_delete ON public.health_medications;
CREATE POLICY health_medications_teen_delete ON public.health_medications
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.health_subjects hs
      JOIN public.child_access ca ON ca.child_id = hs.child_id
      WHERE hs.id = health_medications.subject_id
        AND ca.user_id = auth.uid()
        AND (
          ca.role = 'child'
          OR (ca.role = 'parent' AND public.health_subject_age_band(hs.id) = 'under13')
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_medications TO authenticated;

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
DROP POLICY IF EXISTS health_metrics_tier_read ON public.health_metrics;
CREATE POLICY health_metrics_tier_read ON public.health_metrics
  FOR SELECT USING (
    deleted_at IS NULL
    AND public.health_tier_visible(subject_id, metric_key, health_tier)
  );

-- food_logs INSERT: the diary is H2, unconditionally — a client cannot
-- widen it to H1 to leak the diary into the Wellness scope.
DROP POLICY IF EXISTS food_logs_tenant_insert ON public.food_logs;
CREATE POLICY food_logs_tenant_insert ON public.food_logs
  FOR INSERT WITH CHECK (
    health_tier = 'H2'
    AND EXISTS (SELECT 1 FROM public.health_subjects hs
                WHERE hs.id = food_logs.subject_id
                  AND hs.child_id = ANY (public.current_child_ids()))
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
