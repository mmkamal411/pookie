-- Migration 056: transaction_notes (Plaid user annotations)
--
-- CONTEXT: src/server/services/plaid.ts merges per-transaction user annotations
-- (custom categories, free-text notes) from public.transaction_notes, but no
-- migration ever created the table — the read fails closed (empty merge) on a
-- fresh DB. This creates it.
--
-- CHANGES:
--   1. transaction_notes: owner_user_id (auth.users, cascade) +
--      plaid_transaction_id, custom_category, note, timestamps.
--      UNIQUE (owner_user_id, plaid_transaction_id): one annotation row per
--      transaction per user.
--   2. RLS: owner-only SELECT/INSERT/UPDATE/DELETE (user_id = safe_auth_uid()).
--      service_role bypasses RLS for the server-side merge in plaid.ts.
--
-- REQUIRES: 014 (safe_auth_uid). Nothing else.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
-- CREATE INDEX IF NOT EXISTS / DROP POLICY IF EXISTS. Safe to re-run.
-- GRANT MODEL: table-level SELECT/INSERT/UPDATE/DELETE for authenticated
-- (owner rows only, via RLS); no anon access.

CREATE TABLE IF NOT EXISTS public.transaction_notes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_transaction_id text NOT NULL,
  custom_category     text,
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transaction_notes_owner_tx_unique
    UNIQUE (owner_user_id, plaid_transaction_id)
);

CREATE INDEX IF NOT EXISTS transaction_notes_owner_idx
  ON public.transaction_notes (owner_user_id);

-- updated_at maintenance (same pattern as 017 profiles).
CREATE OR REPLACE FUNCTION public.transaction_notes_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_notes_touch ON public.transaction_notes;
CREATE TRIGGER trg_transaction_notes_touch
  BEFORE UPDATE ON public.transaction_notes
  FOR EACH ROW EXECUTE FUNCTION public.transaction_notes_touch_updated_at();

ALTER TABLE public.transaction_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transaction_notes_owner_read ON public.transaction_notes;
CREATE POLICY transaction_notes_owner_read ON public.transaction_notes
  FOR SELECT USING (owner_user_id = public.safe_auth_uid());

DROP POLICY IF EXISTS transaction_notes_owner_write ON public.transaction_notes;
CREATE POLICY transaction_notes_owner_write ON public.transaction_notes
  FOR INSERT WITH CHECK (owner_user_id = public.safe_auth_uid());

DROP POLICY IF EXISTS transaction_notes_owner_update ON public.transaction_notes;
CREATE POLICY transaction_notes_owner_update ON public.transaction_notes
  FOR UPDATE USING (owner_user_id = public.safe_auth_uid())
  WITH CHECK (owner_user_id = public.safe_auth_uid());

DROP POLICY IF EXISTS transaction_notes_owner_delete ON public.transaction_notes;
CREATE POLICY transaction_notes_owner_delete ON public.transaction_notes
  FOR DELETE USING (owner_user_id = public.safe_auth_uid());

COMMENT ON TABLE public.transaction_notes IS
  'Per-user annotations on Plaid transactions (custom_category, note). Merged read-side in src/server/services/plaid.ts; owner-scoped RLS.';
