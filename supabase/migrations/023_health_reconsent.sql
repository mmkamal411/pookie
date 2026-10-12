-- =============================================================================
-- Implements sol-health.md §2 (18+ re-consent), Appendix A. Depends on 022.
-- Legal gate: counsel sign-off on H0–H3 required before production data flows
-- (NFR-LEGAL); schema itself is complete and tested.
-- =============================================================================
-- DRAFT — DO NOT APPLY until counsel clears H0–H3 (NFR-LEGAL gate).
-- Migration 023: 18+ health re-consent (§1.6.2, FR-HEALTH-007)
--
-- Source: docs/solutions/sol-health.md §2, Appendix A. Depends on 022.
--
-- Contents:
--   1. children.health_reconsent_status enum
--   2. health_corrections (append-only correction history)
--   3. health_device_tokens lifecycle (+ 'suspended_pending_reauth')
--   4. nightly_health_birthday_cutover() — pg_cron, runs at midnight local
--      whether or not the user logs in; privacy cannot wait for a login
--   5. RPCs: rpc_health_reconsent_submit / rpc_health_reconsent_skip /
--      rpc_health_review_queue / rpc_health_record_correct /
--      rpc_health_record_delete / rpc_export_transition_summary
--
-- REVIEW CHECKPOINTS:
--   RC-023-1 (Team 1): cutover expires ALL pre-18 non-subject grants at
--              00:00 local with no grandfathering; skip=private semantics
--              match the spec (§2.2); seal semantics (§2.4) prevent silent
--              re-exposure of pre-18 history.
--   RC-023-2 (Team 2): re-consent RPCs reject H3 (invariant: no grant arm
--              for H3); grants are per-tier per-grantee only.
--   RC-023-3 (Team 1): transition-summary export excludes H3 by default and
--              never persists the PDF; every export audit-logged.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Re-consent status on children
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.health_reconsent_status AS ENUM
    ('not_due','pending','complete','skipped_private');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS health_reconsent_status
    public.health_reconsent_status NOT NULL DEFAULT 'not_due';

-- ---------------------------------------------------------------------------
-- 2. health_corrections — append-only correction history (§1.4, §2.4).
--    Corrections are UPDATEs on the content table + a row here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_corrections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  table_name   text NOT NULL,
  record_id    uuid NOT NULL,
  field        text NOT NULL,
  old_value    text,
  new_value    text,
  corrected_by uuid NOT NULL REFERENCES public.users(id),
  corrected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_corrections_record_idx
  ON public.health_corrections (table_name, record_id);

ALTER TABLE public.health_corrections ENABLE ROW LEVEL SECURITY;

-- Corrections are visible to whoever can see the subject's health (tier of
-- the underlying row governs); written by RPC only.
DROP POLICY IF EXISTS health_corrections_tenant_read ON public.health_corrections;
CREATE POLICY health_corrections_tenant_read ON public.health_corrections
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

GRANT SELECT ON public.health_corrections TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. health_device_tokens lifecycle (§4.1 ingestion, §2.1 cutover).
--    Token VALUES live in the Vault (003_credential_vault), never here —
--    this table is lifecycle state only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_device_tokens (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id          uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  subject_id        uuid REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  provider          text NOT NULL CHECK (provider IN ('apple_healthkit','google_health_connect')),
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','suspended_pending_reauth','revoked','expired')),
  device_name       text,
  vault_ref         text NOT NULL,   -- pointer into the credential vault, NOT the token
  last_sync_at      timestamptz,
  suspended_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_device_tokens_child_idx
  ON public.health_device_tokens (child_id) WHERE status = 'active';

ALTER TABLE public.health_device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_device_tokens_owner_read ON public.health_device_tokens;
CREATE POLICY health_device_tokens_owner_read ON public.health_device_tokens
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

-- Token lifecycle is service_role/RPC only: clients never read vault_ref.
GRANT SELECT ON public.health_device_tokens TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. The cutover job (sol-health §2.1).
--    nightly_health_birthday_cutover() — SECURITY DEFINER, service_role.
--    Finds children whose 18th birthday was today (or newly emancipated),
--    then: expire all non-subject grants; write access_events rows; create
--    health_grace rows (§3.1); set health_reconsent_status='pending';
--    suspend parent-connected device tokens; (re-consent prompt queued by
--    the app at next login — the interstitial is client-side).
--
--    Privacy cannot wait for a login: steps run at midnight local regardless.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nightly_health_birthday_cutover()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutover_count int := 0;
  v_child record;
BEGIN
  FOR v_child IN
    SELECT c.id, c.date_of_birth
    FROM public.children c
    WHERE c.date_of_birth IS NOT NULL
      AND c.date_of_birth = CURRENT_DATE - interval '18 years'
      AND c.health_reconsent_status = 'not_due'
  LOOP
    -- Expire every grant where the grantee is not the subject.
    UPDATE public.health_consent_grants g
    SET status = 'expired', expires_at = now()
    WHERE g.child_id = v_child.id
      AND g.grantee_user_id <> g.granter_user_id
      AND g.status = 'active';

    -- Grace rows: 30 days of HISTORICAL visibility only (§3.1).
    INSERT INTO public.health_grace (child_id, viewer_user_id, tier, grace_expires_at, created_from_event)
    SELECT DISTINCT v_child.id, g.grantee_user_id, g.tier,
           now() + interval '30 days', 'health_cutover_18'
    FROM public.health_consent_grants g
    WHERE g.child_id = v_child.id
      AND g.grantee_user_id <> g.granter_user_id
      AND g.tier IN ('H1','H2')   -- H3 never graced: no parent ever held it
    ON CONFLICT DO NOTHING;

    -- access_events audit (no health content in the log).
    -- RECONCILED 2026-10-12: 021's log_access_event() is the single append
    -- point; raw INSERTs used wrong column names and unlisted event types.
    PERFORM public.log_access_event(
      v_child.id, NULL, 'health_cutover_18', NULL, NULL,
      jsonb_build_object('tiers_cut', ARRAY['H1','H2'], 'grace_days', 30));

    -- Suspend parent-connected device tokens; the adult re-authorizes.
    UPDATE public.health_device_tokens
    SET status = 'suspended_pending_reauth', suspended_at = now()
    WHERE child_id = v_child.id AND status = 'active';

    UPDATE public.children
    SET health_reconsent_status = 'pending'
    WHERE id = v_child.id;

    v_cutover_count := v_cutover_count + 1;
  END LOOP;

  RETURN jsonb_build_object('cutover_count', v_cutover_count,
                            'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.nightly_health_birthday_cutover() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nightly_health_birthday_cutover() TO service_role;

-- pg_cron schedule (idempotent; applied once).
DO $$
BEGIN
  PERFORM cron.schedule(
    'nightly_health_birthday_cutover',
    '0 0 * * *',                                  -- midnight server-local
    $cron$SELECT public.nightly_health_birthday_cutover()$cron$
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Re-consent RPCs (§2.7).
-- ---------------------------------------------------------------------------

-- rpc_health_reconsent_submit(grants jsonb):
-- grants = [{"grantee_user_id": "...", "tier": "H1"|"H2"}]
-- Caller must be the adult subject (child-role on the child). Rejects H3
-- structurally (invariant from §1.3). Each toggle → one grant row.
CREATE OR REPLACE FUNCTION public.rpc_health_reconsent_submit(p_grants jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
  v_g        jsonb;
  v_grantee  uuid;
  v_tier     text;
  v_written  int := 0;
BEGIN
  SELECT c.id INTO v_child_id
  FROM public.children c
  WHERE c.id = ANY (public.current_child_ids())
    AND c.health_reconsent_status IN ('pending','skipped_private','complete')
  LIMIT 1;

  IF v_child_id IS NULL THEN
    RAISE EXCEPTION 'health_reconsent_not_due';
  END IF;

  -- Caller must be the subject themselves (child-role on that child).
  IF NOT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid()
      AND ca.child_id = v_child_id
      AND ca.role = 'child'
  ) THEN
    RAISE EXCEPTION 'health_reconsent_subject_only';
  END IF;

  FOR v_g IN SELECT * FROM jsonb_array_elements(p_grants) LOOP
    v_grantee := (v_g ->> 'grantee_user_id')::uuid;
    v_tier    := v_g ->> 'tier';

    IF v_tier NOT IN ('H1','H2') THEN
      RAISE EXCEPTION 'health_reconsent_tier_refused: %', v_tier;  -- H3/H0 unrepresentable
    END IF;

    -- Grantee must be a linked adult on the same child (parallel-parenting safe).
    IF NOT EXISTS (
      SELECT 1 FROM public.child_access ca
      WHERE ca.user_id = v_grantee
        AND ca.child_id = v_child_id
        AND ca.role = 'parent'
    ) THEN
      RAISE EXCEPTION 'health_reconsent_grantee_not_linked';
    END IF;

    INSERT INTO public.health_consent_grants
      (child_id, granter_user_id, grantee_user_id, tier, status)
    VALUES (v_child_id, auth.uid(), v_grantee, v_tier::public.health_tier, 'active')
    ON CONFLICT DO NOTHING;
    v_written := v_written + 1;
  END LOOP;

  UPDATE public.children
  SET health_reconsent_status = 'complete'
  WHERE id = v_child_id;

  PERFORM public.log_access_event(
    v_child_id, auth.uid(), 'health_reconsent_complete', NULL, NULL,
    jsonb_build_object('grants_written', v_written));

  RETURN jsonb_build_object('status', 'complete', 'grants_written', v_written);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_health_reconsent_submit(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_health_reconsent_submit(jsonb) TO authenticated;

-- rpc_health_reconsent_skip(): skip = private. Recorded as an affirmative
-- choice so the prompt stops appearing.
CREATE OR REPLACE FUNCTION public.rpc_health_reconsent_skip()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
BEGIN
  SELECT c.id INTO v_child_id
  FROM public.children c
  WHERE c.id = ANY (public.current_child_ids())
    AND c.health_reconsent_status = 'pending'
  LIMIT 1;

  IF v_child_id IS NULL THEN
    RAISE EXCEPTION 'health_reconsent_not_due';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid()
      AND ca.child_id = v_child_id
      AND ca.role = 'child'
  ) THEN
    RAISE EXCEPTION 'health_reconsent_subject_only';
  END IF;

  UPDATE public.children
  SET health_reconsent_status = 'skipped_private'
  WHERE id = v_child_id;

  PERFORM public.log_access_event(
    v_child_id, auth.uid(), 'health_reconsent_skipped_private', NULL, NULL, '{}'::jsonb);

  RETURN jsonb_build_object('status', 'skipped_private');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_health_reconsent_skip() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_health_reconsent_skip() TO authenticated;

-- rpc_health_review_queue(): parent-entered rows awaiting review–correct–seal
-- (§2.4). Subject-only.
CREATE OR REPLACE FUNCTION public.rpc_health_review_queue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
  v_result   jsonb;
BEGIN
  SELECT c.id INTO v_child_id
  FROM public.children c
  WHERE c.id = ANY (public.current_child_ids())
  LIMIT 1;

  IF v_child_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.child_access ca
                    WHERE ca.user_id = auth.uid()
                      AND ca.child_id = v_child_id
                      AND ca.role = 'child') THEN
    RAISE EXCEPTION 'health_review_subject_only';
  END IF;

  SELECT jsonb_build_object(
    'metrics', (SELECT coalesce(jsonb_agg(m), '[]'::jsonb)
                FROM public.health_metrics m
                JOIN public.health_subjects hs ON hs.id = m.subject_id
                WHERE hs.child_id = v_child_id
                  AND m.entered_by IS NOT NULL
                  AND m.entered_by <> auth.uid()
                  AND m.sealed_at IS NULL
                  AND m.deleted_at IS NULL),
    'food_logs', (SELECT coalesce(jsonb_agg(f), '[]'::jsonb)
                  FROM public.food_logs f
                  JOIN public.health_subjects hs ON hs.id = f.subject_id
                  WHERE hs.child_id = v_child_id
                    AND f.logged_by IS NOT NULL
                    AND f.logged_by <> auth.uid()
                    AND f.sealed_at IS NULL
                    AND f.deleted_at IS NULL)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_health_review_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_health_review_queue() TO authenticated;

-- rpc_health_record_correct(table, record_id, patch): inline correction with
-- append-only history (§2.4). Allowed tables are whitelisted; patch keys are
-- whitelisted per table (no tier/pki tampering).
CREATE OR REPLACE FUNCTION public.rpc_health_record_correct(
  p_table text, p_record_id uuid, p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_tables constant text[] := ARRAY['health_metrics','food_logs','allergy_list','health_medications'];
  v_allowed_keys   constant text[] :=
    ARRAY['value_numeric','value_text','note','description','allergen','severity',
          'provider','dose_number','administered_at','lot_number',
          'name','dose','schedule','started_at'];
  v_key   text;
  v_old   text;
  v_sql   text;
  v_child uuid;
BEGIN
  IF NOT (p_table = ANY (v_allowed_tables)) THEN
    RAISE EXCEPTION 'health_correct_table_refused: %', p_table;
  END IF;

  FOR v_key IN SELECT * FROM jsonb_object_keys(p_patch) LOOP
    IF NOT (v_key = ANY (v_allowed_keys)) THEN
      RAISE EXCEPTION 'health_correct_field_refused: %', v_key;
    END IF;
  END LOOP;

  -- Resolve the owning child and assert the caller is the subject.
  EXECUTE format(
    'SELECT hs.child_id FROM public.%I t JOIN public.health_subjects hs ON hs.id = t.subject_id WHERE t.id = $1',
    p_table)
    INTO v_child USING p_record_id;

  IF v_child IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid() AND ca.child_id = v_child AND ca.role = 'child'
  ) THEN
    RAISE EXCEPTION 'health_correct_subject_only';
  END IF;

  FOR v_key IN SELECT * FROM jsonb_object_keys(p_patch) LOOP
    EXECUTE format('SELECT (%I)::text FROM public.%I WHERE id = $1', v_key, p_table)
      INTO v_old USING p_record_id;
    INSERT INTO public.health_corrections
      (child_id, table_name, record_id, field, old_value, new_value, corrected_by)
    VALUES (v_child, p_table, p_record_id, v_key, v_old, p_patch ->> v_key, auth.uid());
  END LOOP;

  v_sql := 'UPDATE public.' || quote_ident(p_table) ||
           ' SET sealed_at = now(), sealed_by = $2';
  FOR v_key IN SELECT * FROM jsonb_object_keys(p_patch) LOOP
    v_sql := v_sql || ', ' || quote_ident(v_key) || ' = $3 ->> ' || quote_literal(v_key);
  END LOOP;
  v_sql := v_sql || ' WHERE id = $1';
  EXECUTE v_sql USING p_record_id, auth.uid(), p_patch;

  RETURN jsonb_build_object('corrected', true, 'record_id', p_record_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_health_record_correct(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_health_record_correct(text, uuid, jsonb) TO authenticated;

-- rpc_health_record_delete(table, record_id): tombstone now, hard-delete via
-- the §3.3 purge pipeline (024). H3 fast path: next nightly run.
CREATE OR REPLACE FUNCTION public.rpc_health_record_delete(p_table text, p_record_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_tables constant text[] :=
    ARRAY['health_metrics','food_logs','allergy_list','health_medications','wellbeing_entries'];
  v_child uuid;
BEGIN
  IF NOT (p_table = ANY (v_allowed_tables)) THEN
    RAISE EXCEPTION 'health_delete_table_refused: %', p_table;
  END IF;

  EXECUTE format(
    'SELECT hs.child_id FROM public.%I t JOIN public.health_subjects hs ON hs.id = t.subject_id WHERE t.id = $1',
    p_table)
    INTO v_child USING p_record_id;

  IF v_child IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid() AND ca.child_id = v_child AND ca.role = 'child'
  ) THEN
    RAISE EXCEPTION 'health_delete_subject_only';
  END IF;

  EXECUTE format('UPDATE public.%I SET deleted_at = now() WHERE id = $1', p_table)
    USING p_record_id;

  PERFORM public.log_access_event(
    v_child, auth.uid(), 'health_deletion_requested', NULL, NULL,
    jsonb_build_object('table', p_table));  -- no record IDs that resolve to content

  RETURN jsonb_build_object('tombstoned', true);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_health_record_delete(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_health_record_delete(text, uuid) TO authenticated;

-- rpc_export_transition_summary(format): "take to your new doctor" (§2.5).
-- format ∈ {'pdf','json'}. Subject-only. H3 excluded by default (opt-in
-- per-record via include_h3_record_ids). PDF is streamed and discarded —
-- never persisted. Every export audit-logged.
CREATE OR REPLACE FUNCTION public.rpc_export_transition_summary(
  p_format text DEFAULT 'json',
  p_include_h3_record_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
  v_summary  jsonb;
  v_has_emergency_contacts boolean;
BEGIN
  IF p_format NOT IN ('pdf','json') THEN
    RAISE EXCEPTION 'health_export_format_refused: %', p_format;
  END IF;

  SELECT c.id INTO v_child_id
  FROM public.children c
  WHERE c.id = ANY (public.current_child_ids())
  LIMIT 1;

  IF v_child_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid() AND ca.child_id = v_child_id AND ca.role = 'child'
  ) THEN
    RAISE EXCEPTION 'health_export_subject_only';
  END IF;

  -- W19 emergency_contacts is owned by another squad; include it only when
  -- the table exists, so this function stays valid across landing order.
  v_has_emergency_contacts :=
    to_regclass('public.emergency_contacts') IS NOT NULL;

  -- Assemble the summary from real tables. H3 rows are NEVER included unless
  -- the caller explicitly opts specific record IDs in (per-record default-OFF
  -- checkboxes in the UI, §2.5). SUD records are never includable here —
  -- they have their own disclosure instrument (028).
  SELECT jsonb_build_object(
    'exported_at', now(),
    'format', p_format,
    'conditions', '[]'::jsonb,  -- user-maintained condition list (app layer)
    'medications', (SELECT coalesce(jsonb_agg(
                      jsonb_build_object('name', m.name, 'dose', m.dose,
                                         'schedule', m.schedule,
                                         'started_at', m.started_at)),
                      '[]'::jsonb)
                    FROM public.health_medications m
                    JOIN public.health_subjects hs ON hs.id = m.subject_id
                    WHERE hs.child_id = v_child_id AND m.deleted_at IS NULL),
    'allergies', (SELECT coalesce(jsonb_agg(
                     jsonb_build_object('allergen', coalesce(a.allergen_custom, a.allergen),
                                        'severity', a.severity, 'source', a.source)),
                     '[]'::jsonb)
                   FROM public.allergy_list a
                   JOIN public.health_subjects hs ON hs.id = a.subject_id
                   WHERE hs.child_id = v_child_id AND a.deleted_at IS NULL),
    'immunizations', (SELECT coalesce(jsonb_agg(
                        jsonb_build_object('vaccine_code', i.vaccine_code,
                                           'dose_number', i.dose_number,
                                           'administered_at', i.administered_at,
                                           'provider', i.provider,
                                           'form_3231_on_file', i.form_3231_on_file)),
                        '[]'::jsonb)
                      FROM public.immunizations i
                      JOIN public.health_subjects hs ON hs.id = i.subject_id
                      WHERE hs.child_id = v_child_id AND i.deleted_at IS NULL),
    'vitals_trends', (SELECT coalesce(jsonb_agg(
                        jsonb_build_object('metric_key', t.metric_key,
                                           'display_name', md.display_name,
                                           'unit', md.unit,
                                           'n', t.n,
                                           'min_value', t.min_v,
                                           'max_value', t.max_v,
                                           'avg_value', t.avg_v,
                                           'provenance', t.provenances,
                                           'window', 'trailing 12 months',
                                           'disclaimer', 'Descriptive ranges only. Not a medical device. '
                                                         'For medical advice, talk to a clinician.')),
                        '[]'::jsonb)
                      FROM (
                        SELECT m.metric_key,
                               count(*) AS n,
                               round(min(m.value_numeric), 1) AS min_v,
                               round(max(m.value_numeric), 1) AS max_v,
                               round(avg(m.value_numeric), 1) AS avg_v,
                               array_agg(DISTINCT m.provenance) AS provenances
                        FROM public.health_metrics m
                        JOIN public.health_subjects hs ON hs.id = m.subject_id
                        WHERE hs.child_id = v_child_id
                          AND m.deleted_at IS NULL
                          AND m.value_numeric IS NOT NULL
                          AND m.recorded_at >= now() - interval '12 months'
                        GROUP BY m.metric_key
                      ) t
                      JOIN public.metric_defs md ON md.metric_key = t.metric_key),
    'h3_records_included',
      CASE WHEN array_length(p_include_h3_record_ids, 1) IS NULL THEN '[]'::jsonb
      ELSE (SELECT coalesce(jsonb_agg(
               jsonb_build_object('id', w.id, 'entered_at', w.entered_at,
                                  'mood_label', w.mood_label, 'journal_text', w.journal_text,
                                  'tier', w.health_tier)),
               '[]'::jsonb)
            FROM public.wellbeing_entries w
            WHERE w.id = ANY (p_include_h3_record_ids)
              AND w.health_tier = 'H3'
              AND w.deleted_at IS NULL
              AND EXISTS (SELECT 1 FROM public.child_access ca
                          WHERE ca.user_id = auth.uid()
                            AND ca.child_id = w.child_id
                            AND ca.role = 'child'))
      END,
    'h3_excluded_by_default', true,
    'emergency_contacts',
      CASE WHEN v_has_emergency_contacts THEN
        (SELECT coalesce(jsonb_agg(
           jsonb_build_object('name', ec.name, 'relationship', ec.relationship,
                              'phone', ec.phone)),
           '[]'::jsonb)
         FROM public.emergency_contacts ec
         WHERE ec.child_id = v_child_id)
      ELSE jsonb_build_object('note', 'emergency_contacts not provisioned yet (W19)')
      END,
    'insurance_card', jsonb_build_object('note', 'Masked per W7 rules; populate from vault reference')
  ) INTO v_summary;

  PERFORM public.log_access_event(
    v_child_id, auth.uid(), 'transition_summary_export', NULL, NULL,
    jsonb_build_object('format', p_format,
                       'h3_records_included', coalesce(array_length(p_include_h3_record_ids,1),0)));

  RETURN v_summary;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_export_transition_summary(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_export_transition_summary(text, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Review checkpoint sign-offs.
-- ---------------------------------------------------------------------------
-- | Checkpoint | Reviewer | Date | Result |
-- | RC-023-1   | (Fractional Team 1) | | |
-- | RC-023-2   | (Team 2 RLS audit) | | |
-- | RC-023-3   | (Fractional Team 1) | | |
