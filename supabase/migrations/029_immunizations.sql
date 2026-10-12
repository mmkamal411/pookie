-- DRAFT — DO NOT APPLY until counsel clears H0–H3 (NFR-LEGAL gate).
-- =============================================================================
-- Implements sol-health.md §9 (G22 immunization management), Appendix A.
-- Depends on 022 (tiers), 024 (tombstones).
-- Legal gate: counsel sign-off on H0–H3 required before production data flows
-- (NFR-LEGAL); schema itself is complete and tested.
-- =============================================================================
-- Migration 026: immunizations (CVX), GA Form 3231 tracking, college reqs
--
-- Tier: H1 while <18 (parents need it for school forms — legitimate
-- stewardship); at 18 it follows the §2 cutover like all health data.
-- The 3231 PDF inherits the row's tier.
--
-- Contents:
--   1. immunizations (CVX codes, dose_number, 3231 on-file + expiry)
--   2. college_immunization_reqs (seeded from public pages w/ disclaimer)
--   3. form_3231 reminder scheduling (90/30/7 days)
--   4. private 'health-documents' bucket (3231 PDFs; tier-inherited)
--   5. HPV catch-up annual-reminder state
--
-- REVIEW CHECKPOINTS:
--   RC-026-1 (Team 1): 3231 expiry reminders fire to the right recipient by
--              age band (parent <18, adult 18+); no medical advice in copy.
--   RC-026-2 (Team 2): 3231 PDFs inherit the row tier; storage policies deny
--              by default; signed URLs short TTL server-side.
--   RC-026-3 (Team 1): college reqs carry source_url + verified_at and the
--              "verify at the college's health site" disclaimer.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. immunizations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.immunizations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id       uuid NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  vaccine_code     text NOT NULL,   -- CVX codes (CDC standard; e.g. HPV=62/118/165)
  dose_number      smallint,
  administered_at  date,
  provider         text,
  lot_number       text,
  source           text NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('manual','provider_import','ga_grits')),
  doc_path         text,            -- Form 3231 PDF in the 'health-documents' bucket
  form_3231_on_file boolean NOT NULL DEFAULT false,
  form_3231_expires date,           -- GA 3231 certificates carry expiration dates
  entered_by       uuid REFERENCES public.users(id),
  verified_by_parent boolean NOT NULL DEFAULT false,
  health_tier      public.health_tier NOT NULL DEFAULT 'H1',
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immunizations_subject_idx
  ON public.immunizations (subject_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS immunizations_3231_expiry_idx
  ON public.immunizations (form_3231_expires)
  WHERE form_3231_on_file AND deleted_at IS NULL;

ALTER TABLE public.immunizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS immunizations_tier_read ON public.immunizations;
CREATE POLICY immunizations_tier_read ON public.immunizations
  FOR SELECT USING (
    deleted_at IS NULL
    AND public.health_tier_visible(subject_id, 'immunization', health_tier)
  );

DROP POLICY IF EXISTS immunizations_tenant_insert ON public.immunizations;
CREATE POLICY immunizations_tenant_insert ON public.immunizations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.immunizations.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  );

DROP POLICY IF EXISTS immunizations_tenant_update ON public.immunizations;
CREATE POLICY immunizations_tenant_update ON public.immunizations
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.health_subjects hs
                 WHERE hs.id = public.immunizations.subject_id
                   AND hs.child_id = ANY (public.current_child_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.health_subjects hs
                      WHERE hs.id = public.immunizations.subject_id
                        AND hs.child_id = ANY (public.current_child_ids())));

GRANT SELECT, INSERT, UPDATE ON public.immunizations TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. college_immunization_reqs (reference data; counsel-reviewed, not advice)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.college_immunization_reqs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id       uuid,            -- FK to W5 colleges when that table lands
  college_name     text NOT NULL,
  required_vaccines text[] NOT NULL DEFAULT '{}',  -- CVX codes
  forms            text[] NOT NULL DEFAULT '{}',
  deadline_notes   text,
  source_url       text NOT NULL,
  verified_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.college_immunization_reqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS college_imm_reqs_public_read ON public.college_immunization_reqs;
CREATE POLICY college_imm_reqs_public_read ON public.college_immunization_reqs
  FOR SELECT USING (true);

GRANT SELECT ON public.college_immunization_reqs TO anon, authenticated;
-- Writes are service_role only (curated reference data).

-- ---------------------------------------------------------------------------
-- 3. Reminder scheduling state (90/30/7 days before 3231 expiry).
--    Reminder dispatch is the notification pipeline's job; this table is the
--    dedupe ledger so each window fires exactly once.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.immunization_reminder_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  immunization_id uuid NOT NULL REFERENCES public.immunizations(id) ON DELETE CASCADE,
  window_days     smallint NOT NULL CHECK (window_days IN (90,30,7)),
  recipient_user_id uuid NOT NULL REFERENCES public.users(id),
  sent_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (immunization_id, window_days)
);

ALTER TABLE public.immunization_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS imm_reminder_log_owner_read ON public.immunization_reminder_log;
CREATE POLICY imm_reminder_log_owner_read ON public.immunization_reminder_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.immunizations i
            JOIN public.health_subjects hs ON hs.id = i.subject_id
            WHERE i.id = public.immunization_reminder_log.immunization_id
              AND hs.child_id = ANY (public.current_child_ids()))
  );

GRANT SELECT ON public.immunization_reminder_log TO authenticated;

-- check_immunization_reminders(): nightly. For each on-file 3231 expiring in
-- the 90/30/7-day windows (not yet reminded for that window), queue a
-- notification to the parent (<18 band) or the adult (18+) and record it.
CREATE OR REPLACE FUNCTION public.check_immunization_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queued int := 0;
  v_row record;
  v_band text;
  v_recipient uuid;
  v_window int;
BEGIN
  FOR v_row IN
    SELECT i.id, i.subject_id, i.form_3231_expires, hs.child_id
    FROM public.immunizations i
    JOIN public.health_subjects hs ON hs.id = i.subject_id
    WHERE i.form_3231_on_file
      AND i.form_3231_expires IS NOT NULL
      AND i.deleted_at IS NULL
      AND i.form_3231_expires BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '90 days'
  LOOP
    v_band := public.health_subject_age_band(v_row.subject_id);

    -- Recipient: steward parent (<13), linked parent (13–17), the adult (18+).
    IF v_band = 'under13' OR v_band IN ('teen_13_15','teen_16_17','unknown') THEN
      SELECT ca.user_id INTO v_recipient
      FROM public.child_access ca
      WHERE ca.child_id = v_row.child_id AND ca.role = 'parent'
      ORDER BY ca.created_at LIMIT 1;
    ELSE
      SELECT ca.user_id INTO v_recipient
      FROM public.child_access ca
      WHERE ca.child_id = v_row.child_id AND ca.role = 'child'
      LIMIT 1;
    END IF;

    IF v_recipient IS NULL THEN CONTINUE; END IF;

    FOREACH v_window IN ARRAY ARRAY[90,30,7] LOOP
      IF v_row.form_3231_expires <= CURRENT_DATE + (v_window || ' days')::interval
         AND NOT EXISTS (
           SELECT 1 FROM public.immunization_reminder_log l
           WHERE l.immunization_id = v_row.id AND l.window_days = v_window
         ) THEN
        INSERT INTO public.immunization_reminder_log
          (immunization_id, window_days, recipient_user_id)
        VALUES (v_row.id, v_window, v_recipient);

        PERFORM pg_notify(
          'health_reminder',
          jsonb_build_object(
            'kind', 'form_3231_expiry',
            'window_days', v_window,
            'recipient_user_id', v_recipient,
            'child_id', v_row.child_id,
            'expires', v_row.form_3231_expires,
            'copy', 'GA immunization certificate (Form 3231) expires '
                    || v_row.form_3231_expires::text
                    || '. Ask the pediatrician for an updated form.')::text
        );
        v_queued := v_queued + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('reminders_queued', v_queued, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.check_immunization_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_immunization_reminders() TO service_role;

DO $$
BEGIN
  PERFORM cron.schedule('check_immunization_reminders', '0 7 * * *',
    $cron$SELECT public.check_immunization_reminders()$cron$);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Private 'health-documents' bucket (3231 PDFs; tier-inherited).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('health-documents', 'health-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS health_documents_tier_select ON storage.objects;
CREATE POLICY health_documents_tier_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'health-documents'
    AND EXISTS (
      SELECT 1 FROM public.immunizations i
      JOIN public.health_subjects hs ON hs.id = i.subject_id
      WHERE i.doc_path = storage.objects.name
        AND hs.child_id = ANY (public.current_child_ids())
        AND public.health_tier_visible(i.subject_id, 'immunization', i.health_tier)
    )
  );

DROP POLICY IF EXISTS health_documents_tenant_insert ON storage.objects;
CREATE POLICY health_documents_tenant_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'health-documents'
    AND EXISTS (
      SELECT 1 FROM public.health_subjects hs
      WHERE hs.id = ((storage.foldername(name))[1])::uuid
        AND hs.child_id = ANY (public.current_child_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. HPV catch-up annual reminder state (sol-health §9.2).
--    Once per year, dismissible, clinician-deferring framing only — never a
--    medical recommendation, never repeated nagging.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hpv_reminder_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id       uuid NOT NULL REFERENCES public.health_subjects(id) ON DELETE CASCADE,
  year             smallint NOT NULL,
  recipient_user_id uuid NOT NULL REFERENCES public.users(id),
  sent_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, year)
);

ALTER TABLE public.hpv_reminder_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.hpv_reminder_log TO authenticated;

DROP POLICY IF EXISTS hpv_reminder_log_owner_read ON public.hpv_reminder_log;
CREATE POLICY hpv_reminder_log_owner_read ON public.hpv_reminder_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.health_subjects hs
            WHERE hs.id = public.hpv_reminder_log.subject_id
              AND hs.child_id = ANY (public.current_child_ids()))
  );

CREATE OR REPLACE FUNCTION public.check_hpv_catchup_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queued int := 0;
  v_row record;
  v_doses int;
BEGIN
  -- Subjects 11–17 with incomplete HPV series (CVX 62/118/165), not reminded
  -- this calendar year.
  FOR v_row IN
    SELECT hs.id AS subject_id, hs.child_id
    FROM public.health_subjects hs
    JOIN public.children c ON c.id = hs.child_id
    WHERE c.date_of_birth IS NOT NULL
      AND c.date_of_birth BETWEEN CURRENT_DATE - interval '18 years'
                              AND CURRENT_DATE - interval '11 years'
      AND NOT EXISTS (
        SELECT 1 FROM public.hpv_reminder_log l
        WHERE l.subject_id = hs.id
          AND l.year = EXTRACT(YEAR FROM CURRENT_DATE)::smallint
      )
  LOOP
    SELECT count(DISTINCT i.dose_number) INTO v_doses
    FROM public.immunizations i
    WHERE i.subject_id = v_row.subject_id
      AND i.vaccine_code IN ('62','118','165')
      AND i.deleted_at IS NULL;

    IF v_doses IS NULL OR v_doses < 2 THEN
      -- Parent recipient (13–17 is teen-owned but this reminder is H1
      -- logistics); teen-appropriate version shown to 13+ in-app.
      PERFORM pg_notify(
        'health_reminder',
        jsonb_build_object(
          'kind', 'hpv_catchup',
          'child_id', v_row.child_id,
          'copy', 'HPV vaccination is a routine adolescent vaccine — worth a '
                  'conversation with your pediatrician at the next visit.')::text
      );
      INSERT INTO public.hpv_reminder_log (subject_id, year, recipient_user_id)
      SELECT v_row.subject_id,
             EXTRACT(YEAR FROM CURRENT_DATE)::smallint,
             ca.user_id
      FROM public.child_access ca
      WHERE ca.child_id = v_row.child_id AND ca.role = 'parent'
      ORDER BY ca.created_at LIMIT 1;
      v_queued := v_queued + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('hpv_reminders_queued', v_queued, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.check_hpv_catchup_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_hpv_catchup_reminders() TO service_role;

DO $$
BEGIN
  PERFORM cron.schedule('check_hpv_catchup_reminders', '0 8 * * 1',
    $cron$SELECT public.check_hpv_catchup_reminders()$cron$);  -- weekly; deduped by year log
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Review checkpoint sign-offs.
-- ---------------------------------------------------------------------------
-- | Checkpoint | Reviewer | Date | Result |
-- | RC-026-1   | (Fractional Team 1) | | |
-- | RC-026-2   | (Team 2 RLS audit) | | |
-- | RC-026-3   | (Fractional Team 1) | | |
