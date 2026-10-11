-- Migration 010: W16 school minutiae — the small stuff that still needs doing
-- Source: coordinator brief (docs/MODULE-ARCHITECTURE-BATCH2.md was never committed; see BUILD-LOG 2026-10-11)
--
-- One table: public.school_events, child_id-scoped via public.current_child_ids().
-- The extractor (comms pipeline) writes rows idempotently with dedupe_key +
-- ON CONFLICT DO NOTHING; parents/child ack and manage them from the UI.
-- Deterministic prep lead times per kind live in the route (e.g. field trips
-- get a 7-day prep_deadline); the schema only stores the computed values.
-- source_message_id is a CLAIM column — the FK to the comms message table is
-- added by the comms pipeline's own migration, not here (no cross-module FK
-- before the target table exists — same rule as 007/008's ledger seams).

-- ---------------------------------------------------------------------------
-- school_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id         uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN (
                     'picture_day','field_trip','fundraiser','spirit_week','deadline',
                     'concert','game','performance','meeting','holiday','early_release',
                     'club','volunteer','other')),
  title            text NOT NULL,
  detail           text,
  event_date       date,                          -- the day it happens (NULL = TBD)
  prep_deadline    timestamptz,                   -- do-this-by (deterministic per kind, set by the writer)
  reminder_at      timestamptz,                   -- when to nudge; reminder_sent flips once fired
  reminder_sent    boolean NOT NULL DEFAULT false,
  ack              boolean NOT NULL DEFAULT false,-- someone claimed it ("got it")
  ack_by           uuid REFERENCES public.users(id),
  ack_at           timestamptz,
  owner            text NOT NULL DEFAULT 'parent'
                   CHECK (owner IN ('parent','child','both')),  -- who owns the follow-through
  source           text NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('manual','extractor')),
  source_message_id text,                         -- comms-pipeline claim; FK added by that migration
  dedupe_key       text NOT NULL UNIQUE,          -- tenant-bound by construction: '<child_id>:<kind>:<stable-id>'
  data_class       text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_events_child_date_idx
  ON public.school_events (child_id, event_date);
CREATE INDEX IF NOT EXISTS school_events_child_reminder_idx
  ON public.school_events (child_id, reminder_at) WHERE NOT reminder_sent;
CREATE INDEX IF NOT EXISTS school_events_source_message_id_idx
  ON public.school_events (source_message_id) WHERE source_message_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS: tenant-scoped. SELECT by tenant members; INSERT/UPDATE/DELETE by
-- tenant members (the extractor writes via service_role, which bypasses RLS;
-- ack flips are the main client write).
-- ---------------------------------------------------------------------------
ALTER TABLE public.school_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_events_tenant_read ON public.school_events;
CREATE POLICY school_events_tenant_read ON public.school_events
  FOR SELECT USING (child_id = ANY (public.current_child_ids()));

DROP POLICY IF EXISTS school_events_tenant_write ON public.school_events;
CREATE POLICY school_events_tenant_write ON public.school_events
  FOR ALL USING (child_id = ANY (public.current_child_ids()))
  WITH CHECK (child_id = ANY (public.current_child_ids()));

-- ---------------------------------------------------------------------------
-- Explicit GRANTs (least privilege). No anon grants.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_events TO authenticated;
