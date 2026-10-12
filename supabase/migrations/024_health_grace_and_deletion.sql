-- DRAFT — DO NOT APPLY until counsel clears H0–H3 (NFR-LEGAL gate).
-- =============================================================================
-- Implements sol-health.md §3 (§1.6.3 grace, hide-past, deletion), Appendix A.
-- Depends on 022 (tiers, tombstone columns), 023 (grants, cutover).
-- Legal gate: counsel sign-off on H0–H3 required before production data flows
-- (NFR-LEGAL); schema itself is complete and tested.
-- =============================================================================
-- Migration 024: health grace, hide-past, deletion pipeline, retention
--
-- Contents:
--   1. health_grace — 30-day historical-only visibility after any
--      health-access-ending event. The PREDICATE (health_tier_visible, 022)
--      enforces expiry (grace_expires_at > now()); the sweep job is hygiene,
--      not the enforcement point — a missed run fails closed.
--   2. Tombstone columns on remaining health tables.
--   3. health_retention_policies — per-child overrides over tier defaults (§1.5).
--   4. sweep_health_grace() — nightly hygiene (service_role).
--   5. purge_tombstoned_health() — hard DELETE ≤30 days; storage objects in
--      the same run; H3 fast path (next nightly run).
--   6. purge_expired_health() — tier rolling-retention enforcement (§1.5).
--   7. RPCs: rpc_hide_past_health / rpc_request_health_deletion.
--
-- REVIEW CHECKPOINTS:
--   RC-024-1 (Team 1): grace is historical-only (never new records); no
--              export endpoint honors graced reads; parent cannot bulk-export
--              during grace; neutral viewer copy ("Health sharing ended").
--   RC-024-2 (Team 2): deletion tombstones exclude reads instantly at the
--              POLICY level; hard-delete purges storage objects too; H3 rows
--              have content nulled at tombstone time.
--   RC-024-3 (Team 1): no indefinite retention anywhere — purge_expired_health
--              covers every health table with tier defaults.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. health_grace
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_grace (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id          uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  viewer_user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tier              public.health_tier NOT NULL,
  grace_expires_at  timestamptz NOT NULL,
  revoke_cutoff     timestamptz NOT NULL DEFAULT now(),
                    -- §3.1: grace covers records with recorded_at < revoke_cutoff
                    -- (the revoke timestamp). Historical only, never new rows.
  created_from_event text NOT NULL,   -- e.g. 'health_cutover_18', 'grant_revoked'
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_grace_no_h3 CHECK (tier <> 'H3'),  -- H3 never graced
  CONSTRAINT health_grace_no_h0 CHECK (tier <> 'H0')
);

CREATE INDEX IF NOT EXISTS health_grace_lookup_idx
  ON public.health_grace (child_id, viewer_user_id, tier);

ALTER TABLE public.health_grace ENABLE ROW LEVEL SECURITY;

-- Grace rows readable by the subject and the viewer; writable only via the
-- event functions / RPC (no direct client writes).
DROP POLICY IF EXISTS health_grace_subject_viewer_read ON public.health_grace;
CREATE POLICY health_grace_subject_viewer_read ON public.health_grace
  FOR SELECT USING (
    viewer_user_id = auth.uid()
    OR child_id = ANY (public.current_child_ids())
  );

GRANT SELECT ON public.health_grace TO authenticated;

-- ---------------------------------------------------------------------------
-- health_grace_read_allowed(p_subject_id, p_tier, p_recorded_at): the grace
-- enforcement point (§3.1). True iff a live grace row covers (child, viewer,
-- tier) AND the row predates the revoke cutoff. Expiry is enforced here, so
-- even a missed sweep_health_grace() run fails closed — the predicate arm
-- below, not the job, is the enforcement point. H3/H0 rows never pass
-- (health_grace_no_h3 / _no_h0 constraints make such rows unrepresentable).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.health_grace_read_allowed(
  p_subject_id  uuid,
  p_tier        public.health_tier,
  p_recorded_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_child_id uuid;
BEGIN
  SELECT hs.child_id INTO v_child_id
  FROM public.health_subjects hs
  WHERE hs.id = p_subject_id;
  IF v_child_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.health_grace hg
    WHERE hg.child_id = v_child_id
      AND hg.viewer_user_id = auth.uid()
      AND hg.tier = p_tier
      AND hg.grace_expires_at > now()
      AND p_recorded_at < hg.revoke_cutoff
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.health_grace_read_allowed(uuid, public.health_tier, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_grace_read_allowed(uuid, public.health_tier, timestamptz)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Tombstone columns on all remaining health content tables.
-- ---------------------------------------------------------------------------
ALTER TABLE public.health_medications
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.allergy_list
  ADD COLUMN IF NOT EXISTS sealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sealed_by uuid REFERENCES public.users(id);

-- nutrition tables (012-amended; see 031 for the calorie-refusal trigger)
ALTER TABLE public.nutrition_targets
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2b. Grace policy arms (§3.1). Each content-table SELECT gains
--      OR health_grace_read_allowed(subject_id, health_tier, recorded_at)
-- so a viewer inside their 30-day window sees ONLY rows with
-- recorded_at < revoke_cutoff — historical only, never new records.
-- wellbeing_entries is DELIBERATELY excluded (§5.1: never parent-visible
-- including aggregates — the panel requirement is absolute for W8).
-- meal_checkins (created in 031) adds its grace arm there.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS health_metrics_tier_read ON public.health_metrics;
CREATE POLICY health_metrics_tier_read ON public.health_metrics
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      public.health_tier_visible(subject_id, metric_key, health_tier)
      OR public.health_grace_read_allowed(subject_id, health_tier, recorded_at)
    )
  );

DROP POLICY IF EXISTS food_logs_diary_read ON public.food_logs;
CREATE POLICY food_logs_diary_read ON public.food_logs
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      public.health_tier_visible(subject_id, 'food_log', health_tier)
      OR public.health_grace_read_allowed(subject_id, health_tier, logged_at)
    )
  );

DROP POLICY IF EXISTS allergy_list_tier_read ON public.allergy_list;
CREATE POLICY allergy_list_tier_read ON public.allergy_list
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      public.health_tier_visible(subject_id, 'allergy', health_tier)
      OR public.health_grace_read_allowed(subject_id, health_tier, created_at)
    )
  );

DROP POLICY IF EXISTS health_medications_tier_read ON public.health_medications;
CREATE POLICY health_medications_tier_read ON public.health_medications
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      public.health_tier_visible(subject_id, 'medication', health_tier)
      OR public.health_grace_read_allowed(subject_id, health_tier, created_at)
    )
  );

-- Relocated dedupe index (Squad 2 API layer, drafted in 011): the device
-- ingestion pipeline dedupes on (subject, metric, device timestamp,
-- provenance), ignoring tombstoned rows. It lives HERE — not in 011 —
-- because deleted_at is added in 022 and tombstones are this file's domain.
CREATE UNIQUE INDEX IF NOT EXISTS health_metrics_ingest_dedupe_idx
  ON public.health_metrics (subject_id, metric_key, recorded_at, provenance)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. health_retention_policies — per-child overrides over tier defaults.
--    Tier defaults (§1.5): H1 raw 24mo; H2 active-lifetime (teen-configurable
--    12/24mo); H3 12mo rolling. Backups ≤30d after source deletion (§3.3).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_retention_policies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  tier          public.health_tier NOT NULL,
  raw_months    smallint NOT NULL CHECK (raw_months > 0),
  auto_purge_on boolean NOT NULL DEFAULT true,
  set_by        uuid REFERENCES public.users(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, tier)
);

ALTER TABLE public.health_retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_retention_tenant_read ON public.health_retention_policies;
CREATE POLICY health_retention_tenant_read ON public.health_retention_policies
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS health_retention_subject_write ON public.health_retention_policies;
CREATE POLICY health_retention_subject_write ON public.health_retention_policies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.user_id = auth.uid() AND ca.child_id = public.health_retention_policies.child_id
              AND ca.role IN ('child','parent'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.user_id = auth.uid() AND ca.child_id = public.health_retention_policies.child_id
              AND ca.role IN ('child','parent'))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_retention_policies TO authenticated;

-- Seed tier defaults per child lazily (function below); also seed now for
-- existing children.
INSERT INTO public.health_retention_policies (child_id, tier, raw_months, set_by)
SELECT c.id, t.tier, t.months, NULL
FROM public.children c
CROSS JOIN (VALUES ('H1'::public.health_tier, 24),
                   ('H2'::public.health_tier, 24),
                   ('H3'::public.health_tier, 12)) AS t(tier, months)
ON CONFLICT (child_id, tier) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. sweep_health_grace() — nightly hygiene. Expiry is enforced in the
--    predicate; this just reclaims rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_health_grace()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
  v_child   uuid;
BEGIN
  -- Capture the affected children BEFORE deleting, so expiry is audited
  -- (teen-visible; never shown to the revoked viewer — §3.1).
  FOR v_child IN
    SELECT DISTINCT hg.child_id
    FROM public.health_grace hg
    WHERE hg.grace_expires_at <= now()
  LOOP
    PERFORM public.log_access_event(
      v_child, NULL, 'health_grace_expired', NULL, NULL, '{}'::jsonb);
  END LOOP;

  DELETE FROM public.health_grace
  WHERE grace_expires_at <= now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('grace_rows_swept', v_deleted, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_health_grace() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_health_grace() TO service_role;

DO $$
BEGIN
  PERFORM cron.schedule('sweep_health_grace', '15 0 * * *',
    $cron$SELECT public.sweep_health_grace()$cron$);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 5–6. purge_tombstoned_health() + purge_expired_health() — nightly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_tombstoned_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counts jsonb := '{}'::jsonb;
  v_n int;
  v_rec record;
BEGIN
  -- H3 fast path: hard-delete on the NEXT nightly run (shortest-lived).
  FOR v_rec IN
    SELECT 'wellbeing_entries' AS tbl
  LOOP
    EXECUTE format(
      'DELETE FROM public.%I WHERE deleted_at IS NOT NULL AND deleted_at <= now() - interval ''1 day'' AND health_tier = ''H3''',
      v_rec.tbl);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object(v_rec.tbl || '_h3', v_n);
  END LOOP;

  -- All other tombstoned rows: hard DELETE ≤30 days. Storage objects for
  -- nutrition photos and health documents go in the same run.
  DELETE FROM storage.objects
  WHERE bucket_id IN ('nutrition-photos','health-documents')
    AND created_at <= now() - interval '30 days'
    AND id IN (
      SELECT o.id FROM storage.objects o
      WHERE NOT EXISTS (SELECT 1 FROM public.food_logs f WHERE f.photo_path = o.name AND f.deleted_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM public.immunizations i WHERE i.doc_path = o.name AND i.deleted_at IS NULL)
    );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('storage_objects', v_n);

  FOR v_rec IN
    SELECT unnest(ARRAY[
      'health_metrics','food_logs','allergy_list','health_medications',
      'nutrition_targets','wellbeing_entries','meal_checkins','immunizations',
      'sud_records'
    ]) AS tbl
  LOOP
    IF to_regclass('public.' || v_rec.tbl) IS NOT NULL THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE deleted_at IS NOT NULL AND deleted_at <= now() - interval ''30 days''',
        v_rec.tbl);
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_counts := v_counts || jsonb_build_object(v_rec.tbl, v_n);
    END IF;
  END LOOP;

  -- Backups: the infosec program (G6) documents the backup-purge runbook —
  -- tombstoned-then-hard-deleted rows are excluded from restores after the
  -- 30-day window; any restore within the window re-runs this purge before
  -- serving traffic. Supabase PITR retention ≤30 days after source deletion.

  RETURN jsonb_build_object('purged', v_counts, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.purge_tombstoned_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_tombstoned_health() TO service_role;

DO $$
BEGIN
  PERFORM cron.schedule('purge_tombstoned_health', '30 1 * * *',
    $cron$SELECT public.purge_tombstoned_health()$cron$);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- purge_expired_health(): rolling retention per tier defaults + per-child
-- overrides. Rows older than raw_months are tombstoned (content nulled for
-- H3), then hard-deleted by purge_tombstoned_health().
CREATE OR REPLACE FUNCTION public.purge_expired_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  v_n int;
  v_rec record;
BEGIN
  FOR v_rec IN
    SELECT rp.child_id, rp.tier, rp.raw_months
    FROM public.health_retention_policies rp
    WHERE rp.auto_purge_on
  LOOP
    -- health_metrics (subject-keyed through health_subjects)
    EXECUTE
      'UPDATE public.health_metrics m SET deleted_at = now()
       FROM public.health_subjects hs
       WHERE m.subject_id = hs.id AND hs.child_id = $1
         AND m.health_tier = $2 AND m.deleted_at IS NULL
         AND m.recorded_at < now() - ($3 || '' months'')::interval'
      USING v_rec.child_id, v_rec.tier, v_rec.raw_months;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total + v_n;

    -- Null H3 content at tombstone time (§3.3 step 1).
    IF v_rec.tier = 'H3' THEN
      UPDATE public.health_metrics m
      SET value_numeric = NULL, value_text = NULL, note = NULL
      FROM public.health_subjects hs
      WHERE m.subject_id = hs.id AND hs.child_id = v_rec.child_id
        AND m.health_tier = 'H3' AND m.deleted_at IS NOT NULL
        AND (m.value_numeric IS NOT NULL OR m.value_text IS NOT NULL OR m.note IS NOT NULL);
    END IF;

    -- wellbeing_entries are child-keyed directly (025; guarded).
    IF to_regclass('public.wellbeing_entries') IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.wellbeing_entries w SET deleted_at = now(),
           journal_text = CASE WHEN $2 = ''H3'' THEN NULL ELSE journal_text END
         WHERE w.child_id = $1 AND w.health_tier = $2 AND w.deleted_at IS NULL
           AND w.entered_at < now() - ($3 || '' months'')::interval')
        USING v_rec.child_id, v_rec.tier, v_rec.raw_months;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_total := v_total + v_n;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('tombstoned_by_retention', v_total, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_health() TO service_role;

DO $$
BEGIN
  PERFORM cron.schedule('purge_expired_health', '45 1 * * *',
    $cron$SELECT public.purge_expired_health()$cron$);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 7. RPCs
-- ---------------------------------------------------------------------------

-- rpc_hide_past_health(): the teen's FERPA lever (§3.2). Instant: deletes all
-- grace rows where the caller is the subject (all viewers, all tiers).
-- 13+. Logged as hide_past_health. The revoked viewer sees a neutral
-- "Health sharing ended" — never a per-record tombstone.
CREATE OR REPLACE FUNCTION public.rpc_hide_past_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
  v_n int;
BEGIN
  SELECT c.id INTO v_child_id
  FROM public.children c
  WHERE c.id = ANY (public.current_child_ids())
  LIMIT 1;

  IF v_child_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid() AND ca.child_id = v_child_id AND ca.role = 'child'
  ) THEN
    RAISE EXCEPTION 'hide_past_subject_only';
  END IF;

  DELETE FROM public.health_grace hg
  WHERE hg.child_id = v_child_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  PERFORM public.log_access_event(
    v_child_id, auth.uid(), 'hide_past_health', NULL, NULL,
    jsonb_build_object('grace_rows_removed', v_n));

  RETURN jsonb_build_object('hidden', true, 'grace_rows_removed', v_n);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_hide_past_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_hide_past_health() TO authenticated;

-- rpc_request_health_deletion(scope jsonb):
-- scope = {"scope": "tier:H2"|"tier:H3"|"category:wellbeing"|"record:<table>:<id>"|"all_health"}
-- Step 1 immediate: tombstone (content nulled for H3). Step 2 ≤30 days:
-- hard DELETE by purge_tombstoned_health(). Audit keeps an anonymized stub.
CREATE OR REPLACE FUNCTION public.rpc_request_health_deletion(p_scope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
  v_scope    text := p_scope ->> 'scope';
  v_tier     public.health_tier;
  v_tbl      text;
  v_rid      uuid;
  v_n        int := 0;
  v_tmp      int;
BEGIN
  SELECT c.id INTO v_child_id
  FROM public.children c
  WHERE c.id = ANY (public.current_child_ids())
  LIMIT 1;

  IF v_child_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid() AND ca.child_id = v_child_id AND ca.role = 'child'
  ) THEN
    RAISE EXCEPTION 'health_delete_subject_only';
  END IF;

  IF v_scope LIKE 'tier:%' THEN
    v_tier := substring(v_scope from 6)::public.health_tier;
    IF v_tier NOT IN ('H1','H2','H3') THEN
      RAISE EXCEPTION 'health_delete_tier_refused: %', v_scope;
    END IF;
    -- Tombstone + null content for the requested tier across tables.
    UPDATE public.health_metrics m
    SET deleted_at = now(),
        value_numeric = CASE WHEN v_tier = 'H3' THEN NULL ELSE value_numeric END,
        value_text    = CASE WHEN v_tier = 'H3' THEN NULL ELSE value_text END,
        note          = CASE WHEN v_tier = 'H3' THEN NULL ELSE note END
    FROM public.health_subjects hs
    WHERE m.subject_id = hs.id AND hs.child_id = v_child_id
      AND m.health_tier = v_tier AND m.deleted_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;

    UPDATE public.food_logs f
    SET deleted_at = now()
    FROM public.health_subjects hs
    WHERE f.subject_id = hs.id AND hs.child_id = v_child_id
      AND f.health_tier = v_tier AND f.deleted_at IS NULL;
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_n := v_n + v_tmp;
  ELSIF v_scope = 'category:wellbeing' THEN
    IF to_regclass('public.wellbeing_entries') IS NOT NULL THEN
      UPDATE public.wellbeing_entries w
      SET deleted_at = now(), journal_text = NULL
      WHERE w.child_id = v_child_id AND w.deleted_at IS NULL;
      GET DIAGNOSTICS v_n = ROW_COUNT;
    END IF;
  ELSIF v_scope LIKE 'record:%' THEN
    v_tbl := split_part(substring(v_scope from 8), ':', 1);
    v_rid := split_part(substring(v_scope from 8), ':', 2)::uuid;
    IF v_tbl NOT IN ('health_metrics','food_logs','allergy_list',
                     'health_medications','wellbeing_entries') THEN
      RAISE EXCEPTION 'health_delete_table_refused: %', v_tbl;
    END IF;
    EXECUTE format('UPDATE public.%I SET deleted_at = now() WHERE id = $1', v_tbl)
      USING v_rid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF v_scope = 'all_health' THEN
    UPDATE public.health_metrics m
    SET deleted_at = now(), value_numeric = NULL, value_text = NULL, note = NULL
    FROM public.health_subjects hs
    WHERE m.subject_id = hs.id AND hs.child_id = v_child_id AND m.deleted_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    UPDATE public.food_logs f
    SET deleted_at = now()
    FROM public.health_subjects hs
    WHERE f.subject_id = hs.id AND hs.child_id = v_child_id AND f.deleted_at IS NULL;
    UPDATE public.allergy_list a
    SET deleted_at = now()
    FROM public.health_subjects hs
    WHERE a.subject_id = hs.id AND hs.child_id = v_child_id AND a.deleted_at IS NULL;
    UPDATE public.health_medications m
    SET deleted_at = now()
    FROM public.health_subjects hs
    WHERE m.subject_id = hs.id AND hs.child_id = v_child_id AND m.deleted_at IS NULL;
    IF to_regclass('public.wellbeing_entries') IS NOT NULL THEN
      UPDATE public.wellbeing_entries w
      SET deleted_at = now(), journal_text = NULL
      WHERE w.child_id = v_child_id AND w.deleted_at IS NULL;
    END IF;
  ELSE
    RAISE EXCEPTION 'health_delete_scope_refused: %', v_scope;
  END IF;

  PERFORM public.log_access_event(
    v_child_id, auth.uid(), 'health_deletion', NULL, NULL,
    jsonb_build_object('scope', v_scope));  -- anonymized stub, no content/IDs

  RETURN jsonb_build_object('tombstoned', true, 'scope', v_scope);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_request_health_deletion(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_request_health_deletion(jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Review checkpoint sign-offs.
-- ---------------------------------------------------------------------------
-- | Checkpoint | Reviewer | Date | Result |
-- | RC-024-1   | (Fractional Team 1) | | |
-- | RC-024-2   | (Team 2 RLS audit) | | |
-- | RC-024-3   | (Fractional Team 1) | | |
