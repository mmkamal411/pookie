-- Migration 049: trusted-adult foreign keys, backfilled (Squad 1 Safety Track)
--
-- CONTEXT: the coordinator's renumbering placed trusted_adults at 048, after
-- the safety migrations that reference it (030/032/036). A REFERENCES clause
-- requires the target table at CREATE TABLE time, so those migrations declare
-- plain uuid columns; this file adds the foreign keys once trusted_adults
-- exists. Sort order matters: this file must apply AFTER
-- 048_safety_trusted_adults.sql (the '049_safety_' prefix guarantees that).
--
-- All constraints are ON DELETE SET NULL: deleting a trusted adult never
-- cascades into audit rows (crisis_events, crisis_alerts) or workflow rows.
--
-- IDEMPOTENT: each ADD CONSTRAINT is guarded by a pg_constraint check.
-- Safe to re-run.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'trusted_adults')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint
                     WHERE conname = 'crisis_events_trusted_adult_fk') THEN
    ALTER TABLE public.crisis_events
      ADD CONSTRAINT crisis_events_trusted_adult_fk
      FOREIGN KEY (trusted_adult_id)
      REFERENCES public.trusted_adults(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'trusted_adults')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint
                     WHERE conname = 'crisis_alerts_trusted_adult_fk') THEN
    ALTER TABLE public.crisis_alerts
      ADD CONSTRAINT crisis_alerts_trusted_adult_fk
      FOREIGN KEY (trusted_adult_id)
      REFERENCES public.trusted_adults(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'trusted_adults')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint
                     WHERE conname = 'outing_plans_recipient_trusted_adult_fk') THEN
    ALTER TABLE public.outing_plans
      ADD CONSTRAINT outing_plans_recipient_trusted_adult_fk
      FOREIGN KEY (recipient_trusted_adult_id)
      REFERENCES public.trusted_adults(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'trusted_adults')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint
                     WHERE conname = 'emergency_requests_requested_by_trusted_adult_fk') THEN
    ALTER TABLE public.emergency_requests
      ADD CONSTRAINT emergency_requests_requested_by_trusted_adult_fk
      FOREIGN KEY (requested_by_trusted_adult_id)
      REFERENCES public.trusted_adults(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Verification (run after applying)
-- ---------------------------------------------------------------------------
-- 1. All four constraints exist:
--    SELECT conname FROM pg_constraint WHERE conname LIKE '%trusted_adult_fk';
--    -- expect 4 rows
-- 2. Deleting a trusted adult SET NULLs the referencing columns (no cascade
--    into audit rows).
-- 3. check.sh passes.
