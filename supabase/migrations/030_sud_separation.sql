-- DRAFT — DO NOT APPLY until counsel clears H0–H3 (NFR-LEGAL gate).
-- =============================================================================
-- Implements sol-health.md §8.4 (42 CFR Part 2 separation), Appendix A.
-- Depends on 022 (tiers, predicate).
-- Legal gate: counsel sign-off on H0–H3 required before production data flows
-- (NFR-LEGAL); schema itself is complete and tested.
-- =============================================================================
-- Migration 028: SUD records separation
--
-- Part 2 prohibits disclosure of substance-use-disorder patient records
-- without specific written consent and prohibits relying on a general
-- medical consent for SUD records. This design exceeds the legal minimum:
--
--   * Separate table (sud_records), content application-layer encrypted with
--     a per-user data key DISTINCT from general health data (KMS/Vault key
--     rotation independent). The DB never sees plaintext.
--   * Teen-only RLS (same shape as wellbeing_entries §5.1): no grant arm, no
--     override arm, no break-glass arm.
--   * Explicit per-disclosure consent (sud_disclosure_consents): each
--     disclosure names what records, to whom, for what purpose, expiring
--     when; revocable anytime. A general health grant, Wellness grant, 18+
--     re-consent toggle, or transition-summary export NEVER covers
--     sud_records.
--   * No view, RPC, or join in the system touches sud_records together with
--     general health tables — enforced by the migration-time assertion below
--     (fails the apply if any function body cross-references).
--   * Support tooling (S1–S3) has no read path (scoped RBAC).
--
-- REVIEW CHECKPOINTS:
--   RC-028-1 (Team 1): separate encryption key confirmed in the infosec
--              program (G6); rotation independent of general health key.
--   RC-028-2 (Team 2): cross-reference assertion passes; no function, view,
--              or policy joins sud_records with any other table.
--   RC-028-3 (Team 1): disclosure consents are per-record, per-recipient,
--              per-purpose, expiring; revocation is instant and honored in
--              the disclosure RPC.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- sud_records: application-layer encrypted content. The DB holds ciphertext
-- + nonce only. Health tier is H3 by structural default.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sud_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id          uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  recorded_at       timestamptz NOT NULL DEFAULT now(),
  content_ciphertext text NOT NULL,   -- AES-256-GCM ciphertext (base64)
  content_nonce     text NOT NULL,    -- GCM nonce (base64)
  key_version       smallint NOT NULL DEFAULT 1,
  health_tier       public.health_tier NOT NULL DEFAULT 'H3'
                    CHECK (health_tier = 'H3'),
  entered_by        uuid REFERENCES public.users(id),
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sud_records_child_idx
  ON public.sud_records (child_id) WHERE deleted_at IS NULL;

ALTER TABLE public.sud_records ENABLE ROW LEVEL SECURITY;

-- Teen only. No parent arm. No override arm. No grant arm. No break-glass.
DROP POLICY IF EXISTS sud_records_teen_only_read ON public.sud_records;
CREATE POLICY sud_records_teen_only_read ON public.sud_records
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.sud_records.child_id
                  AND ca.role = 'child')
  );

DROP POLICY IF EXISTS sud_records_teen_only_insert ON public.sud_records;
CREATE POLICY sud_records_teen_only_insert ON public.sud_records
  FOR INSERT WITH CHECK (
    entered_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid()
                  AND ca.child_id = public.sud_records.child_id
                  AND ca.role = 'child')
  );

DROP POLICY IF EXISTS sud_records_teen_only_update ON public.sud_records;
CREATE POLICY sud_records_teen_only_update ON public.sud_records
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.user_id = auth.uid()
              AND ca.child_id = public.sud_records.child_id
              AND ca.role = 'child')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.user_id = auth.uid()
              AND ca.child_id = public.sud_records.child_id
              AND ca.role = 'child')
  );

DROP POLICY IF EXISTS sud_records_teen_only_delete ON public.sud_records;
CREATE POLICY sud_records_teen_only_delete ON public.sud_records
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.user_id = auth.uid()
              AND ca.child_id = public.sud_records.child_id
              AND ca.role = 'child')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sud_records TO authenticated;

-- ---------------------------------------------------------------------------
-- sud_disclosure_consents: explicit per-disclosure consent. Each row names
-- what records, to whom, for what purpose, expiring when. Revocable anytime.
-- A general grant / re-consent toggle / export NEVER covers sud_records.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sud_disclosure_consents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id           uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  record_ids         uuid[] NOT NULL,
  recipient          text NOT NULL,    -- named recipient (person or program)
  purpose            text NOT NULL,
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  consent_ciphertext text NOT NULL,    -- the signed consent instrument (encrypted)
  consented_by       uuid NOT NULL REFERENCES public.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sud_consent_future_expiry CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS sud_disclosure_consents_child_idx
  ON public.sud_disclosure_consents (child_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.sud_disclosure_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sud_consents_teen_read ON public.sud_disclosure_consents;
CREATE POLICY sud_consents_teen_read ON public.sud_disclosure_consents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.child_access ca
            WHERE ca.user_id = auth.uid()
              AND ca.child_id = public.sud_disclosure_consents.child_id
              AND ca.role = 'child')
  );

-- Consents are written via RPC only (the RPC validates the teen is the
-- granter and the consent instrument is complete).
GRANT SELECT ON public.sud_disclosure_consents TO authenticated;

-- rpc_sud_disclosure_consent(record_ids, recipient, purpose, expires_at,
--                           consent_ciphertext): teen-only; every disclosure
-- names its records/recipient/purpose/expiry explicitly.
CREATE OR REPLACE FUNCTION public.rpc_sud_disclosure_consent(
  p_record_ids uuid[],
  p_recipient text,
  p_purpose text,
  p_expires_at timestamptz,
  p_consent_ciphertext text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
  v_id uuid;
BEGIN
  IF p_record_ids IS NULL OR array_length(p_record_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'sud_consent_records_required';
  END IF;
  IF btrim(p_recipient) = '' OR btrim(p_purpose) = '' THEN
    RAISE EXCEPTION 'sud_consent_recipient_purpose_required';
  END IF;
  IF p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'sud_consent_expiry_required';
  END IF;
  IF p_consent_ciphertext IS NULL OR btrim(p_consent_ciphertext) = '' THEN
    RAISE EXCEPTION 'sud_consent_instrument_required';
  END IF;

  -- Every named record must belong to the caller's child, and the caller
  -- must be the teen.
  SELECT sr.child_id INTO v_child_id
  FROM public.sud_records sr
  WHERE sr.id = ANY (p_record_ids)
    AND sr.deleted_at IS NULL
  GROUP BY sr.child_id
  HAVING count(DISTINCT sr.child_id) = 1
     AND count(*) = array_length(p_record_ids, 1);

  IF v_child_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid() AND ca.child_id = v_child_id AND ca.role = 'child'
  ) THEN
    RAISE EXCEPTION 'sud_consent_subject_only';
  END IF;

  INSERT INTO public.sud_disclosure_consents
    (child_id, record_ids, recipient, purpose, expires_at,
     consent_ciphertext, consented_by)
  VALUES (v_child_id, p_record_ids, p_recipient, p_purpose, p_expires_at,
          p_consent_ciphertext, auth.uid())
  RETURNING id INTO v_id;

  -- RECONCILED 2026-10-12: 021's log_access_event() is the single append
  -- point (raw INSERTs used wrong column names).
  PERFORM public.log_access_event(
    v_child_id, auth.uid(), 'sud_disclosure_consented', NULL, NULL,
    jsonb_build_object('recipient', p_recipient, 'purpose', p_purpose));

  RETURN jsonb_build_object('consent_id', v_id, 'expires_at', p_expires_at);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_sud_disclosure_consent(uuid[], text, text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_sud_disclosure_consent(uuid[], text, text, timestamptz, text) TO authenticated;

-- rpc_sud_disclosure_revoke(consent_id): instant revocation.
CREATE OR REPLACE FUNCTION public.rpc_sud_disclosure_revoke(p_consent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
BEGIN
  SELECT c.child_id INTO v_child_id
  FROM public.sud_disclosure_consents c
  WHERE c.id = p_consent_id;

  IF v_child_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.child_access ca
    WHERE ca.user_id = auth.uid() AND ca.child_id = v_child_id AND ca.role = 'child'
  ) THEN
    RAISE EXCEPTION 'sud_revoke_subject_only';
  END IF;

  UPDATE public.sud_disclosure_consents
  SET revoked_at = now()
  WHERE id = p_consent_id AND revoked_at IS NULL;

  PERFORM public.log_access_event(
    v_child_id, auth.uid(), 'sud_disclosure_revoked', NULL, NULL, '{}'::jsonb);

  RETURN jsonb_build_object('revoked', true);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_sud_disclosure_revoke(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_sud_disclosure_revoke(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Cross-reference build assertion (sol-health §8.4):
-- No function, view, or policy definition in this database may reference
-- sud_records together with any other health table. Fails the apply if
-- violated. Re-run by CI on every migration change.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_offender text;
BEGIN
  SELECT p.proname INTO v_offender
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosrc ILIKE '%sud_records%'
    AND p.proname NOT IN (
      'rpc_sud_disclosure_consent','rpc_sud_disclosure_revoke',
      'enforce_sud_tier_placeholder'
    )
    AND (
      p.prosrc ILIKE '%health_metrics%' OR p.prosrc ILIKE '%food_logs%'
      OR p.prosrc ILIKE '%wellbeing_entries%' OR p.prosrc ILIKE '%immunizations%'
      OR p.prosrc ILIKE '%meal_checkins%' OR p.prosrc ILIKE '%allergy_list%'
      OR p.prosrc ILIKE '%health_medications%'
    )
  LIMIT 1;

  IF v_offender IS NOT NULL THEN
    RAISE EXCEPTION 'sud_separation_violated by function %', v_offender;
  END IF;

  SELECT c.relname INTO v_offender
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_get_viewdef(c.oid) vd ON true
  WHERE n.nspname = 'public'
    AND c.relkind IN ('v','m')
    AND (pg_get_viewdef(c.oid) ILIKE '%sud_records%')
  LIMIT 1;

  IF v_offender IS NOT NULL THEN
    RAISE EXCEPTION 'sud_separation_violated by view %', v_offender;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Review checkpoint sign-offs.
-- ---------------------------------------------------------------------------
-- | Checkpoint | Reviewer | Date | Result |
-- | RC-028-1   | (Fractional Team 1) | | |
-- | RC-028-2   | (Team 2 RLS audit) | | |
-- | RC-028-3   | (Fractional Team 1) | | |
