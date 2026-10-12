-- Migration 011: W22 health tracker — person registry, metric readings, privacy tiers, safety overrides
-- Source: coordinator brief (docs/MODULE-ARCHITECTURE-BATCH2.md was never committed; see BUILD-LOG 2026-10-11)
--
-- Scoping: the new minimal public.health_subjects person registry anchors
-- every subject to a child tenant (child_id NOT NULL) plus an owner_user_id
-- household anchor. The owner_user_id carries ZERO authorization semantics —
-- it is bookkeeping only. child_access stays the single source of truth:
-- every policy funnels through public.current_child_ids().
--
-- Privacy tiers (H0-H3 taxonomy; amended 2026-10-12), enforced in
-- health_tier_visible() and therefore in the health_metrics SELECT policy:
--   * H1 shareable wellness: tenant / Wellness-scope family reads.
--   * H2 teen-private: teen only at 13+, via explicit teen grant or a
--     time-boxed (<=30d), teen-notified, unappealed safety override.
--   * H3 legally sensitive: teen only. No parent path — no grants, no
--     overrides, no aggregates, no exceptions. Unknown DOB fails closed
--     into the 13–15 arm.
-- Safety override: parent-only INSERT, 20-char minimum reason (CHECK),
-- teen_notified_at recorded in-transaction (the route performs the
-- notification; the column proves it happened), revocation via revoked_at
-- (append-only: no DELETE). Override reads are audited at the route layer.
--
-- W22 is the DATA layer; W2 is the INTERPRETATION layer (seam contract:
-- neither writes the other's tables).
--
-- Wellness-only guardrails (grep-verifiable): NO diagnostic or dosing
-- columns exist in this migration — no diagnosis, dose, dosage, insulin,
-- or prescription columns anywhere. Dexcom is a real-API integration via
-- Edge Functions with tokens in the Vault (no schema surface here);
-- BP/Libre/Accu-Chek are manual in v1.
--
-- COUNSEL-GATED: public.state_minor_consent_rules ships here but vision §5
-- requires LICENSED-COUNSEL REVIEW before the health module ships. The table
-- defaults counsel_reviewed=false and nothing in this migration (or 012)
-- treats its rows as reviewed. Do not ship W22/W23 UI until counsel signs.

-- AMENDED 2026-10-12 per docs/solutions/sol-health.md §1.7 (still unapplied;
-- edit-in-place, single chain). Changes vs original draft:
--   1. NEW public.health_tier enum ('H0','H1','H2','H3'); metric_defs.
--      default_sensitivity REPLACED by metric_defs.health_tier (seed
--      remapped routine->H1, sensitive->H2 per §1.6 backfill map).
--   2. health_metric_visible() SUPERSEDED by health_tier_visible
--      (subject_id, metric_key, tier) — the §1.3 tier x age-band matrix,
--      deny-by-default. NEW health_tier_insert_allowed() write guard.
--   3. health_safety_overrides: H2-ONLY (tier CHECK='H2'), expires_at with
--      <=30-day CHECK, teen_appealed_at (16-17 early-revoke path).
--   4. health_subject_age_band(): 'teen' split into 'teen_13_15' /
--      'teen_16_17'; 'unknown' still fails closed into the 13–15 arm.
-- Full chain still BLOCKED on the NFR-LEGAL gate (counsel clears H0–H3).

-- ---------------------------------------------------------------------------
-- health_tier: the H0–H3 privacy taxonomy (sol-health §1.1, amended 2026-10-12).
-- H0 prohibited for <18 · H1 shareable wellness · H2 teen-private · H3
-- legally sensitive (no parent path ever — see health_tier_visible()).
-- This enum is the single tier vocabulary for every health table; row-level
-- health_tier columns are stamped at write from metric_defs, never re-derived.
-- ---------------------------------------------------------------------------
CREATE TYPE public.health_tier AS ENUM ('H0', 'H1', 'H2', 'H3');

-- ---------------------------------------------------------------------------
-- health_subjects: the person registry. Every subject anchors to a child
-- tenant (child_id) — that is the ONLY authorization key. owner_user_id is
-- the household bookkeeping anchor and grants nothing by itself.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_subjects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- household anchor; ZERO auth semantics
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,  -- the tenant key
  subject_kind  text NOT NULL DEFAULT 'child'
                CHECK (subject_kind IN ('child','household_member')),
  label         text NOT NULL,                   -- display name, e.g. 'Dawson'
  notes         text,
  data_class    text NOT NULL DEFAULT 'S' CHECK (data_class IN ('S','T','P')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_subjects_child_id_idx
  ON public.health_subjects (child_id);
CREATE INDEX IF NOT EXISTS health_subjects_owner_id_idx
  ON public.health_subjects (owner_user_id);

-- ---------------------------------------------------------------------------
-- metric_defs: metric registry (what can be recorded). health_tier is the
-- privacy tier (H0–H3 taxonomy, sol-health §1.1–1.2); health_tier_visible()
-- applies the age bands on top. Tiering rule of thumb: if a reasonable teen
-- would hesitate to have a parent read it aloud at the dinner table, it is
-- not H1. If it relates to consentable care, it is H3.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metric_defs (
  metric_key          text PRIMARY KEY,          -- e.g. 'blood_glucose'
  display_name        text NOT NULL,
  unit                text,                      -- e.g. 'mg/dL', 'lb', 'mmHg'
  category            text NOT NULL CHECK (category IN ('vitals','growth','glucose','activity','sleep','other')),
  health_tier         public.health_tier NOT NULL DEFAULT 'H1',
  source_types        text[] NOT NULL DEFAULT '{manual}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.metric_defs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS metric_defs_authenticated_read ON public.metric_defs;
CREATE POLICY metric_defs_authenticated_read ON public.metric_defs
  FOR SELECT USING (true);

GRANT SELECT ON public.metric_defs TO authenticated;

-- Seed: wellness metrics only. No diagnostic/dosing metrics exist by design.
INSERT INTO public.metric_defs (metric_key, display_name, unit, category, health_tier, source_types) VALUES
  ('weight',                 'Weight',                  'lb',    'growth',   'H2', '{manual,device}'),
  ('height',                 'Height',                  'in',    'growth',   'H1', '{manual}'),
  ('blood_pressure_systolic','Blood pressure (systolic)','mmHg', 'vitals',   'H1', '{manual,device}'),
  ('blood_pressure_diastolic','Blood pressure (diastolic)','mmHg','vitals',  'H1', '{manual,device}'),
  ('heart_rate_resting',     'Resting heart rate',      'bpm',   'vitals',   'H1', '{manual,device}'),
  ('body_temperature',       'Body temperature',        '°F',    'vitals',   'H1', '{manual}'),
  ('blood_glucose',          'Blood glucose',           'mg/dL', 'glucose',  'H2', '{manual,dexcom,device}'),
  ('hba1c',                  'HbA1c',                   '%',     'glucose',  'H2', '{manual,device}'),
  ('sleep_hours',            'Sleep',                   'hours', 'sleep',    'H1', '{manual,device}'),
  ('steps_daily',            'Daily steps',             'steps', 'activity', 'H1', '{manual,device}')
ON CONFLICT (metric_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- health_metrics: the readings. One row per observation; corrections are
-- UPDATEs, history is preserved by the app (W22 never deletes silently —
-- no DELETE grant is issued... see GRANTs below).
-- Columns are deliberately limited to observed values + provenance:
-- value_numeric / value_text / note. There is NO diagnosis column, NO dose
-- column, NO dosing schedule — wellness tracking only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_metrics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    uuid NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  metric_key    text NOT NULL REFERENCES public.metric_defs(metric_key),
  value_numeric numeric,                          -- the observed number (NULL when value_text carries it)
  value_text    text,                             -- e.g. '120/80' style composites, when needed
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  source        text NOT NULL DEFAULT 'manual'
                CHECK (source IN ('manual','dexcom','device','import')),
  entered_by    uuid REFERENCES public.users(id),
  note          text,                             -- free text; trends-only framing enforced in UI copy
  data_class    text NOT NULL DEFAULT 'S' CHECK (data_class IN ('S','T','P')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_metric_value_present CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS health_metrics_subject_metric_recorded_idx
  ON public.health_metrics (subject_id, metric_key, recorded_at DESC);

-- NOTE (2026-10-12, data-layer): the device-ingestion dedupe index
-- (subject, metric, recorded_at, provenance, ignoring tombstoned rows) was
-- drafted here but references provenance (added in 022) and deleted_at
-- (added in 024). It now lives in 024_health_grace_and_deletion.sql, where
-- both columns exist. See BUILD-LOG 2026-10-12 (Squad 2 coordination note).

-- ---------------------------------------------------------------------------
-- health_safety_overrides: the audited safety-override trail. Parent-only
-- INSERT (policy below); reason has a 20-char minimum (CHECK);
-- teen_notified_at is NOT NULL — the route must notify the teen in the same
-- transaction that inserts the row. Revocation is revoked_at (append-only;
-- no DELETE policy/grant). Reads are route-audited (auditEvent).
--
-- AMENDED 2026-10-12 (sol-health §1.7.2 / C2): overrides are H2-ONLY
-- (tier CHECK='H2' — never H3, never H0); they EXPIRE ≤30 days (expires_at
-- NOT NULL, CHECK against created_at); a 16–17 teen may appeal and revoke
-- early (teen_appealed_at — one tap, no guilt screens). The predicate treats
-- an appealed or expired override as dead.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_safety_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id      uuid NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  metric_key      text NOT NULL REFERENCES public.metric_defs(metric_key),
  parent_user_id  uuid NOT NULL REFERENCES public.users(id),  -- the parent who invoked the override (audited)
  reason          text NOT NULL CHECK (char_length(btrim(reason)) >= 20),
  tier            public.health_tier NOT NULL DEFAULT 'H2'
                  CHECK (tier = 'H2'),                     -- H2-only, enforced. Never H3, never H0.
  teen_notified_at timestamptz NOT NULL DEFAULT now(),  -- proof the teen was notified in-transaction
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  teen_appealed_at timestamptz,                         -- 16–17 early-revoke path (NULL = not appealed)
  revoked_at      timestamptz,
  data_class      text NOT NULL DEFAULT 'S' CHECK (data_class IN ('S','T','P')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_safety_override_expiry_cap
    CHECK (expires_at <= created_at + interval '30 days')
);

CREATE INDEX IF NOT EXISTS health_safety_overrides_subject_metric_idx
  ON public.health_safety_overrides (subject_id, metric_key) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- state_minor_consent_rules: per-state minor-consent rules.
-- *** COUNSEL-GATED (vision §5): licensed-counsel review REQUIRED before the
-- health module ships. counsel_reviewed defaults FALSE; no policy, function,
-- or route in 011/012 may treat an unreviewed row as authoritative. ***
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.state_minor_consent_rules (
  state_code        text PRIMARY KEY,            -- e.g. 'GA'
  rule_summary      text NOT NULL,
  minor_consent_age smallint,                    -- NULL = no minor-consent provision encoded
  notes             text,
  as_of             date NOT NULL,
  source            text NOT NULL,
  counsel_reviewed  boolean NOT NULL DEFAULT false,
  counsel_reviewed_at timestamptz,
  counsel_reviewer  text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.state_minor_consent_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS state_minor_consent_rules_authenticated_read ON public.state_minor_consent_rules;
CREATE POLICY state_minor_consent_rules_authenticated_read ON public.state_minor_consent_rules
  FOR SELECT USING (true);

GRANT SELECT ON public.state_minor_consent_rules TO authenticated;
-- No client INSERT/UPDATE/DELETE: rows are seeded/updated by service_role
-- only after licensed-counsel review.

-- ---------------------------------------------------------------------------
-- health_subject_age_band(p_subject_id): 'under13' | 'teen_13_15' |
-- 'teen_16_17' | 'adult' | 'unknown' (NULL DOB). SECURITY DEFINER,
-- search_path pinned. AMENDED 2026-10-12 (sol-health §1.7.3): the 'teen'
-- band is split so the §1.3 access matrix can distinguish shared agency
-- (13–15) from full agency (16–17, incl. early override-revoke). 'unknown'
-- fails closed into the 13–15 arm inside health_tier_visible().
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

REVOKE ALL ON FUNCTION public.health_subject_age_band(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_subject_age_band(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- health_tier_visible(p_subject_id, p_metric_key, p_tier): THE privacy predicate.
-- SUPERSEDES health_metric_visible() (dropped below; sol-health §1.6–1.7).
-- Implements the §1.3 access matrix (tier × age band). Deny by default:
-- every arm is explicit; anything unlisted returns false.
--
-- Bands: under13 | teen_13_15 | teen_16_17 | adult | unknown
-- ('unknown' DOB fails closed into the 13–15 arm.)
--
--   H0: false for every minor band. Adult band: the subject themselves only
--       (per-record consent sharing is a future mechanism; no grant arm here).
--   H1: under13 -> steward parents (tenant). teen bands/unknown -> the teen,
--       or a parent holding the Wellness scope for the child (default ON at
--       link per FR-ACCESS-006 §1.3.3; a teen revocation recorded in
--       health_consent_grants closes the arm). adult -> the subject, or a
--       parent with an active POST-18 H1 re-consent grant (affirmative,
--       default OFF — §2).
--   H2: under13 -> steward parents (tenant). teen bands/unknown -> the teen,
--       OR an active teen-made H2 grant naming the caller, OR an active,
--       unexpired, teen-notified, unappealed H2 safety override (H2-only,
--       metric-keyed — non-metric tables never take this arm). adult -> the
--       subject, or a parent with an active POST-18 H2 re-consent grant.
--   H3: the teen (child-role on the child) and nobody else. No grant arm,
--       no override arm, no aggregate arm, no break-glass arm. Ever.
--
-- entered_by is deliberately NOT consulted: a parent-entered row for a 13+
-- teen does not widen visibility (spec §1.6.5).
--
-- Late-bound dependencies: public.health_consent_grants (022),
-- public.health_grace (024). plpgsql resolves these at call time, so this
-- function is valid before those migrations apply — but arms that depend on
-- those tables return false until they exist (deny by default holds).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.health_tier_visible(
  p_subject_id uuid,
  p_metric_key text,
  p_tier       public.health_tier
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_child_id   uuid;
  v_band       text;
  v_is_subject boolean;   -- caller is the subject themselves (child-role on the child)
  v_is_parent  boolean;   -- caller holds a parent role on the child
  v_adult_since date;     -- subject's 18th birthday (NULL when DOB unknown)
BEGIN
  -- Arm 0: unknown subject -> false.
  SELECT hs.child_id INTO v_child_id
  FROM public.health_subjects hs
  WHERE hs.id = p_subject_id;
  IF v_child_id IS NULL THEN
    RETURN false;
  END IF;

  -- Arm 1: subject's child not in the caller's tenant set -> false.
  -- child_access is the single source of truth; owner_user_id grants nothing.
  IF NOT (v_child_id = ANY (public.current_child_ids())) THEN
    RETURN false;
  END IF;

  v_band := public.health_subject_age_band(p_subject_id);

  SELECT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid() AND ca.child_id = v_child_id AND ca.role = 'child'
  ) INTO v_is_subject;

  SELECT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid() AND ca.child_id = v_child_id AND ca.role = 'parent'
  ) INTO v_is_parent;

  SELECT (c.date_of_birth + interval '18 years')::date INTO v_adult_since
  FROM public.children c WHERE c.id = v_child_id;

  -- H3: teen-only. No other arm. Ever.
  IF p_tier = 'H3' THEN
    RETURN v_is_subject;
  END IF;

  -- H0: never collected/stored for minors. Adult band: subject only.
  IF p_tier = 'H0' THEN
    RETURN (v_band = 'adult' AND v_is_subject);
  END IF;

  -- H1 / H2 below.
  -- Under-13 stewardship: tenant parents see H1/H2 (tenant membership
  -- already proven in Arm 1).
  IF v_band = 'under13' THEN
    RETURN true;
  END IF;

  -- The subject always sees their own data, every tier, every band.
  IF v_is_subject THEN
    RETURN true;
  END IF;

  -- Adult band: parents need an active POST-18 per-tier re-consent grant
  -- (affirmative opt-in; skip = private — §2). No grandfathering.
  IF v_band = 'adult' THEN
    RETURN EXISTS (
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
        AND v_adult_since IS NOT NULL
        AND g.granted_at >= v_adult_since
    );
  END IF;

  -- Teen bands (13–15, 16–17) and unknown DOB (fails closed here):
  IF p_tier = 'H1' THEN
    -- Wellness scope: default ON at link (spec §1.3, FR-ACCESS-006).
    -- SEAM — Platform Team 1 / access-model owner: until migration 021's
    -- link-time grant rows land, "default ON" is structural — a parent-role
    -- caller passes unless the teen recorded a revocation. Confirm or
    -- replace with explicit seeded grant rows; do not silently invert.
    RETURN v_is_parent AND NOT EXISTS (
      SELECT 1 FROM public.health_consent_grants g
      WHERE g.child_id = v_child_id
        AND g.grantee_user_id = auth.uid()
        AND g.tier = 'H1'
        AND g.status = 'revoked'
    );
  END IF;

  -- H2, teen bands: explicit teen-made grant OR live safety override.
  IF p_tier = 'H2' THEN
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

    -- Time-boxed, teen-notified safety override (H2-only, metric-keyed).
    RETURN (
      p_metric_key IS NOT NULL
      AND v_is_parent
      AND EXISTS (
        SELECT 1 FROM public.health_safety_overrides so
        WHERE so.subject_id = p_subject_id
          AND so.metric_key = p_metric_key
          AND so.tier = 'H2'
          AND so.parent_user_id = auth.uid()
          AND so.revoked_at IS NULL
          AND so.teen_appealed_at IS NULL
          AND so.expires_at > now()
          AND so.teen_notified_at IS NOT NULL
      )
    );
  END IF;

  RETURN false;
END;
$func$;

REVOKE ALL ON FUNCTION public.health_tier_visible(uuid, text, public.health_tier) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_tier_visible(uuid, text, public.health_tier) TO authenticated, service_role;
-- Deliberately NO grant to agent_reader (security review M1): health tables
-- are not in the agent read path.

-- The superseded two-level predicate is removed; nothing may reference it.
DROP FUNCTION IF EXISTS public.health_metric_visible(uuid, text);

-- ---------------------------------------------------------------------------
-- health_tier_insert_allowed(p_subject_id, p_metric_key, p_tier): write guard
-- for WITH CHECK policies. H3 INSERT requires the teen (child-role); a parent
-- attempting an H3 write about a 13+ teen is refused with the named code
-- 'h3_parent_write_refusal' (sol-health §8.1.5 — no laundering surveillance
-- into the teen's most protected tier). H0 INSERT is refused for every minor
-- band ('h0_minor_refusal', logged to access_events by the route).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.health_tier_insert_allowed(
  p_subject_id uuid,
  p_metric_key text,
  p_tier       public.health_tier
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_child_id uuid;
  v_band     text;
BEGIN
  SELECT hs.child_id INTO v_child_id
  FROM public.health_subjects hs
  WHERE hs.id = p_subject_id;
  IF v_child_id IS NULL THEN
    RETURN false;
  END IF;
  IF NOT (v_child_id = ANY (public.current_child_ids())) THEN
    RETURN false;
  END IF;

  v_band := public.health_subject_age_band(p_subject_id);

  IF p_tier = 'H0' AND v_band <> 'adult' THEN
    RAISE EXCEPTION 'h0_minor_refusal';
  END IF;

  IF p_tier = 'H3' THEN
    IF EXISTS (
      SELECT 1 FROM public.child_access ca
      WHERE ca.user_id = auth.uid() AND ca.child_id = v_child_id AND ca.role = 'child'
    ) THEN
      RETURN true;
    END IF;
    RAISE EXCEPTION 'h3_parent_write_refusal';
  END IF;

  RETURN true;
END;
$func$;

REVOKE ALL ON FUNCTION public.health_tier_insert_allowed(uuid, text, public.health_tier) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_tier_insert_allowed(uuid, text, public.health_tier) TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- assert_health_subject(p_subject_id): DB-side tenant assertion for the
-- health module. Raises unless the subject's child is in the caller's tenant
-- set. Backend's TS assertHealthSubject() (src/server/tenant.ts) is the
-- app-layer counterpart and remains backend-owned; routes may call this RPC
-- for a second, DB-enforced check.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_health_subject(p_subject_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_subject_id IS NULL THEN
    RAISE EXCEPTION 'health_subject_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.health_subjects hs
    WHERE hs.id = p_subject_id
      AND hs.child_id = ANY (public.current_child_ids())
  ) THEN
    RAISE EXCEPTION 'health_subject_access_denied';
  END IF;
  RETURN p_subject_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_health_subject(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_health_subject(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.health_subjects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_metrics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_safety_overrides ENABLE ROW LEVEL SECURITY;

-- health_subjects: tenant read; tenant write with owner_user_id = auth.uid()
-- on insert (the anchor must be self-asserted; it still grants no read).
DROP POLICY IF EXISTS health_subjects_tenant_read ON public.health_subjects;
CREATE POLICY health_subjects_tenant_read ON public.health_subjects
  FOR SELECT USING (
    child_id = ANY (public.current_child_ids())
  );

DROP POLICY IF EXISTS health_subjects_tenant_insert ON public.health_subjects;
CREATE POLICY health_subjects_tenant_insert ON public.health_subjects
  FOR INSERT WITH CHECK (
    owner_user_id = auth.uid()
    AND child_id = ANY (public.current_child_ids())
  );

DROP POLICY IF EXISTS health_subjects_tenant_update ON public.health_subjects;
CREATE POLICY health_subjects_tenant_update ON public.health_subjects
  FOR UPDATE
  USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (
    child_id = ANY (public.current_child_ids())
    AND owner_user_id = auth.uid()
  );

DROP POLICY IF EXISTS health_subjects_tenant_delete ON public.health_subjects;
CREATE POLICY health_subjects_tenant_delete ON public.health_subjects
  FOR DELETE USING (child_id = ANY (public.current_child_ids()));

-- health_metrics: SELECT through the privacy predicate; INSERT/UPDATE by
-- tenant members (a child-role caller is already restricted to their own
-- child by current_child_ids()); no DELETE (corrections are UPDATEs —
-- append-only history is preserved by the app).
DROP POLICY IF EXISTS health_metrics_privacy_read ON public.health_metrics;
DROP POLICY IF EXISTS health_metrics_tier_read ON public.health_metrics;
CREATE POLICY health_metrics_tier_read ON public.health_metrics
  FOR SELECT USING (
    public.health_tier_visible(
      subject_id,
      metric_key,
      (SELECT md.health_tier FROM public.metric_defs md WHERE md.metric_key = health_metrics.metric_key)
    )
  );
-- NOTE (022): once health_tier is stamped on the row, this policy is
-- rewritten to read the row column instead of re-deriving from the def.

DROP POLICY IF EXISTS health_metrics_tenant_insert ON public.health_metrics;
CREATE POLICY health_metrics_tenant_insert ON public.health_metrics
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.health_metrics.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
    AND public.health_tier_insert_allowed(
      subject_id,
      metric_key,
      (SELECT md.health_tier FROM public.metric_defs md WHERE md.metric_key = health_metrics.metric_key)
    )
  );

DROP POLICY IF EXISTS health_metrics_tenant_update ON public.health_metrics;
CREATE POLICY health_metrics_tenant_update ON public.health_metrics
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.health_metrics.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.health_metrics.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  );

-- health_safety_overrides: parent-only INSERT (self-attributed); parent-role
-- SELECT (route-audited); creating-parent UPDATE (revocation); no DELETE.
DROP POLICY IF EXISTS health_safety_overrides_parent_insert ON public.health_safety_overrides;
CREATE POLICY health_safety_overrides_parent_insert ON public.health_safety_overrides
  FOR INSERT WITH CHECK (
    parent_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.health_subjects hs
      JOIN public.child_access ca
        ON ca.child_id = hs.child_id
       AND ca.user_id = auth.uid()
       AND ca.role = 'parent'
      WHERE hs.id = public.health_safety_overrides.subject_id
    )
  );

DROP POLICY IF EXISTS health_safety_overrides_parent_read ON public.health_safety_overrides;
CREATE POLICY health_safety_overrides_parent_read ON public.health_safety_overrides
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.health_subjects hs
      JOIN public.child_access ca
        ON ca.child_id = hs.child_id
       AND ca.user_id = auth.uid()
       AND ca.role = 'parent'
      WHERE hs.id = public.health_safety_overrides.subject_id
    )
  );

DROP POLICY IF EXISTS health_safety_overrides_creator_update ON public.health_safety_overrides;
CREATE POLICY health_safety_overrides_creator_update ON public.health_safety_overrides
  FOR UPDATE
  USING (parent_user_id = auth.uid())
  WITH CHECK (parent_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Explicit GRANTs (least privilege). No DELETE grant on health_metrics or
-- health_safety_overrides (append-only by design). No anon grants anywhere
-- in W22. No agent_reader grants (M1).
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.health_safety_overrides TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- REVIEW CHECKPOINTS — 011 amendments (2026-10-12, sol-health §1.7)
-- ── RC-011-A — Fractional Team 1 (Compliance) ─────────────────────────────
-- Verify: health_tier enum values + metric_defs seed tiers match sol-health
-- §1.2 backfill map; safety overrides are H2-only with ≤30-day expiry and a
-- teen-appeal path; GA consent rules remain counsel-gated (reviewed=false).
-- ── RC-011-B — Team 2 (RLS audit) ─────────────────────────────────────────
-- Verify: health_tier_visible() arm-by-arm against the §1.3 matrix (esp. H3
-- absolute, adult-band post-18 grant gating, unknown-DOB fail-closed);
-- health_tier_insert_allowed() refuses H3-parent / H0-minor writes with the
-- named codes; no agent_reader grants. Phase completion blocked on sign-off.
-- ═══════════════════════════════════════════════════════════════════════════
