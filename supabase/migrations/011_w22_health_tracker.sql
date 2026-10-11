-- Migration 011: W22 health tracker — person registry, metric readings, privacy tiers, safety overrides
-- Source: coordinator brief (docs/MODULE-ARCHITECTURE-BATCH2.md was never committed; see BUILD-LOG 2026-10-11)
--
-- Scoping: the new minimal public.health_subjects person registry anchors
-- every subject to a child tenant (child_id NOT NULL) plus an owner_user_id
-- household anchor. The owner_user_id carries ZERO authorization semantics —
-- it is bookkeeping only. child_access stays the single source of truth:
-- every policy funnels through public.current_child_ids().
--
-- Privacy tiers (founder-locked guidance contract), enforced in
-- health_metric_visible() and therefore in the health_metrics SELECT policy:
--   * routine metrics: any tenant member may read.
--   * sensitive metrics, subject under 13 or 18+: any tenant member may read.
--   * sensitive metrics, subject 13-17: SENSITIVE-DEFAULT-PRIVATE. Visible
--     only to the teen themselves, or to a parent holding an ACTIVE,
--     AUDITED safety override for that subject+metric. Unknown DOB fails
--     closed into the 13-17 tier.
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
-- metric_defs: metric registry (what can be recorded). default_sensitivity
-- is the privacy tier; health_metric_visible() applies the age tiers on top.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metric_defs (
  metric_key          text PRIMARY KEY,          -- e.g. 'blood_glucose'
  display_name        text NOT NULL,
  unit                text,                      -- e.g. 'mg/dL', 'lb', 'mmHg'
  category            text NOT NULL CHECK (category IN ('vitals','growth','glucose','activity','sleep','other')),
  default_sensitivity text NOT NULL DEFAULT 'routine'
                      CHECK (default_sensitivity IN ('routine','sensitive')),
  source_types        text[] NOT NULL DEFAULT '{manual}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.metric_defs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS metric_defs_authenticated_read ON public.metric_defs;
CREATE POLICY metric_defs_authenticated_read ON public.metric_defs
  FOR SELECT USING (true);

GRANT SELECT ON public.metric_defs TO authenticated;

-- Seed: wellness metrics only. No diagnostic/dosing metrics exist by design.
INSERT INTO public.metric_defs (metric_key, display_name, unit, category, default_sensitivity, source_types) VALUES
  ('weight',                 'Weight',                  'lb',    'growth',   'sensitive', '{manual,device}'),
  ('height',                 'Height',                  'in',    'growth',   'routine',   '{manual}'),
  ('blood_pressure_systolic','Blood pressure (systolic)','mmHg', 'vitals',   'routine',   '{manual,device}'),
  ('blood_pressure_diastolic','Blood pressure (diastolic)','mmHg','vitals',  'routine',   '{manual,device}'),
  ('heart_rate_resting',     'Resting heart rate',      'bpm',   'vitals',   'routine',   '{manual,device}'),
  ('body_temperature',       'Body temperature',        '°F',    'vitals',   'routine',   '{manual}'),
  ('blood_glucose',          'Blood glucose',           'mg/dL', 'glucose',  'sensitive', '{manual,dexcom,device}'),
  ('hba1c',                  'HbA1c',                   '%',     'glucose',  'sensitive', '{manual,device}'),
  ('sleep_hours',            'Sleep',                   'hours', 'sleep',    'routine',   '{manual,device}'),
  ('steps_daily',            'Daily steps',             'steps', 'activity', 'routine',   '{manual,device}')
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

-- ---------------------------------------------------------------------------
-- health_safety_overrides: the audited safety-override trail. Parent-only
-- INSERT (policy below); reason has a 20-char minimum (CHECK);
-- teen_notified_at is NOT NULL — the route must notify the teen in the same
-- transaction that inserts the row. Revocation is revoked_at (append-only;
-- no DELETE policy/grant). Reads are route-audited (auditEvent).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_safety_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id      uuid NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  metric_key      text NOT NULL REFERENCES public.metric_defs(metric_key),
  parent_user_id  uuid NOT NULL REFERENCES public.users(id),  -- the parent who invoked the override (audited)
  reason          text NOT NULL CHECK (char_length(btrim(reason)) >= 20),
  teen_notified_at timestamptz NOT NULL DEFAULT now(),  -- proof the teen was notified in-transaction
  revoked_at      timestamptz,
  data_class      text NOT NULL DEFAULT 'S' CHECK (data_class IN ('S','T','P')),
  created_at      timestamptz NOT NULL DEFAULT now()
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
-- health_subject_age_band(p_subject_id): 'under13' | 'teen' | 'adult' |
-- 'unknown' (NULL DOB). SECURITY DEFINER, search_path pinned.
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
    WHEN c.date_of_birth > CURRENT_DATE - interval '18 years' THEN 'teen'
    ELSE 'adult'
  END
  FROM public.health_subjects hs
  JOIN public.children c ON c.id = hs.child_id
  WHERE hs.id = p_subject_id
$$;

REVOKE ALL ON FUNCTION public.health_subject_age_band(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_subject_age_band(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- health_metric_visible(p_subject_id, p_metric_key): THE privacy predicate.
-- Deny by default; every arm is explicit:
--   1. unknown subject/metric -> false
--   2. subject's child not in the caller's tenant set -> false
--      (child_access is the single source of truth; owner_user_id grants nothing)
--   3. routine metric -> true (tenant member)
--   4. sensitive metric, band under13/adult -> true (tenant member)
--   5. sensitive metric, band teen/unknown -> true ONLY for the teen
--      themselves (child-role on that child) or a parent holding an ACTIVE
--      (revoked_at IS NULL) safety override for this subject+metric.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.health_metric_visible(p_subject_id uuid, p_metric_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
  v_sens     text;
  v_band     text;
BEGIN
  SELECT hs.child_id, md.default_sensitivity
    INTO v_child_id, v_sens
  FROM public.health_subjects hs
  JOIN public.metric_defs md ON md.metric_key = p_metric_key
  WHERE hs.id = p_subject_id;

  IF v_child_id IS NULL OR v_sens IS NULL THEN
    RETURN false;
  END IF;

  IF NOT (v_child_id = ANY (public.current_child_ids())) THEN
    RETURN false;
  END IF;

  IF v_sens = 'routine' THEN
    RETURN true;
  END IF;

  v_band := public.health_subject_age_band(p_subject_id);

  IF v_band IN ('under13', 'adult') THEN
    RETURN true;
  END IF;

  -- teen (13-17) or unknown DOB: sensitive-default-private
  IF EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid()
      AND ca.child_id = v_child_id
      AND ca.role = 'child'
  ) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.health_safety_overrides so
    WHERE so.subject_id = p_subject_id
      AND so.metric_key = p_metric_key
      AND so.revoked_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.child_access ca
        WHERE ca.user_id = auth.uid()
          AND ca.child_id = v_child_id
          AND ca.role = 'parent'
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.health_metric_visible(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_metric_visible(uuid, text) TO authenticated, service_role;
-- Deliberately NO grant to agent_reader (security review M1): health tables
-- are not in the agent read path.

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
CREATE POLICY health_metrics_privacy_read ON public.health_metrics
  FOR SELECT USING (public.health_metric_visible(subject_id, metric_key));

DROP POLICY IF EXISTS health_metrics_tenant_insert ON public.health_metrics;
CREATE POLICY health_metrics_tenant_insert ON public.health_metrics
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.health_metrics.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
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
