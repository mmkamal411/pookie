-- Migration 028: W14 Co-parenting — immutable logistics log, parallel-parenting (FR-MOD-W14)
--
-- Panel 🛑 redesign (spec FR-MOD-W14, R5): high-conflict co-parenting as a
-- shared messaging thread is a screenshot-weaponization surface. Required:
--   - Parallel-parenting mode: separate surfaces per parent; NO shared
--     messaging thread. Entries are author-scoped; the other parent's view is
--     a separate read surface (no reply chain, no thread).
--   - Immutable log: INSERT-only. No UPDATE/DELETE policies, no grants —
--     entries cannot be edited or deleted by anyone (corrections are new
--     entries referencing the old one).
--   - Logistics-only at launch: entry_type is CHECK-constrained to logistics
--     kinds ('pickup','dropoff','expense','schedule','medical_logistics');
--     free-form messaging kinds are rejected by the schema until family-law
--     practitioner review (R5). No child-as-courier: children get zero rows.
--   - Custody-order awareness: custody_order_ref + travel_restriction_flags
--     (FR-SAFETY-012) ride on every entry so logistics stay inside the order.
--
-- GATE: launch read-only/logistics-only pending family-law review. The
-- 'message' entry_type and any two-way surface are schema-blocked until
-- counsel approves; expanding the CHECK list is the review's output.

CREATE TABLE IF NOT EXISTS public.coparenting_log (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id                uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,  -- tenant key
  author_id               uuid NOT NULL REFERENCES public.users(id),      -- the parent who wrote it
  entry_type              text NOT NULL
                          CHECK (entry_type IN ('pickup','dropoff','expense','schedule','medical_logistics')),
  content                 text NOT NULL,                                  -- logistics facts only, never messaging
  expense_amount          numeric(10,2),                                  -- for entry_type='expense'
  occurs_at               timestamptz,                                    -- the logistics event time (pickup, appointment)
  custody_order_ref       text,                                           -- e.g. "2024-CV-12345 §4.2 pickup schedule"
  travel_restriction_flags jsonb NOT NULL DEFAULT '{}'::jsonb,           -- FR-SAFETY-012: out-of-state / passport holds
  corrects_entry_id       uuid REFERENCES public.coparenting_log(id),    -- corrections are NEW rows, never edits
  data_class              text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coparenting_log_child_created_idx
  ON public.coparenting_log (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS coparenting_log_child_author_idx
  ON public.coparenting_log (child_id, author_id);

-- ---------------------------------------------------------------------------
-- RLS: parents of the child only; children get zero rows (no child-as-courier).
-- INSERT-only: there are deliberately NO update/delete policies. Corrections
-- are new rows with corrects_entry_id.
-- Parallel-parenting: a parent reads the full log for their own child, but the
-- API exposes it as two surfaces (mine / theirs) — see BACKEND-CONTRACTS.md.
-- ---------------------------------------------------------------------------
ALTER TABLE public.coparenting_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coparenting_log_parent_read ON public.coparenting_log;
CREATE POLICY coparenting_log_parent_read ON public.coparenting_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM unnest(public.current_child_ids()) AS c(cid)
            WHERE c.cid = public.coparenting_log.child_id)
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.child_id = public.coparenting_log.child_id
                  AND ca.user_id = auth.uid() AND ca.role = 'parent')
  );

DROP POLICY IF EXISTS coparenting_log_parent_insert ON public.coparenting_log;
CREATE POLICY coparenting_log_parent_insert ON public.coparenting_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM unnest(public.current_child_ids()) AS c(cid)
            WHERE c.cid = public.coparenting_log.child_id)
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.child_id = public.coparenting_log.child_id
                  AND ca.user_id = auth.uid() AND ca.role = 'parent')
    AND author_id = auth.uid()
  );

-- Least-privilege grants: SELECT + INSERT only. No UPDATE/DELETE grant —
-- immutability is enforced by the absence of both policy and grant.
GRANT SELECT, INSERT ON public.coparenting_log TO authenticated;
