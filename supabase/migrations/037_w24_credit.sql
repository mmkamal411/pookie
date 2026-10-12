-- Migration 027: W24 Credit — minor security-freeze management (FR-MOD-W24)
--
-- RE-SCOPED (panel 🛑 → spec FR-MOD-W24): 3-bureau credit MONITORING never
-- ships (no FCRA permissible purpose; bureaus will not furnish). This module
-- is minor security-freeze management under O.C.G.A. §§ 10-1-914/914.1
-- (Georgia's protected-consumer freeze law) + credit-hygiene coaching via a
-- licensed partner. NO bureau pulls, NO scores, NO monitoring — the schema
-- has no columns for any of that, deliberately.
--
-- GATE: the ENTIRE module is gated behind FCRA counsel sign-off.
-- counsel_review_status on every row defaults to 'pending'; the API returns
-- the module as "pending review" until counsel approves. The data model and
-- the pending-state UI ship now; freeze actions are inert until the gate
-- flips. This is a legal gate, not a feature flag — it is flipped by counsel,
-- never by a deploy.

-- ---------------------------------------------------------------------------
-- credit_freezes: one row per (child, bureau) freeze record.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_freezes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id             uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,  -- tenant key
  bureau               text NOT NULL CHECK (bureau IN ('equifax','experian','transunion','innovis','chexsystems')),
  freeze_status        text NOT NULL DEFAULT 'not_requested'
                       CHECK (freeze_status IN ('not_requested','requested','confirmed','temporarily_lifted','removed','error')),
  requested_by         uuid REFERENCES public.users(id),      -- parent who initiated
  requested_at         timestamptz,
  confirmed_at         timestamptz,
  confirmation_ref     text,                                  -- bureau confirmation code (opaque)
  lift_requested_at    timestamptz,
  lift_expires_at      timestamptz,
  notes                text,
  -- The gate: counsel sign-off state for THIS record's lifecycle.
  counsel_review_status text NOT NULL DEFAULT 'pending'
                       CHECK (counsel_review_status IN ('pending','approved','rejected')),
  counsel_reviewed_by  text,                                 -- counsel identity (name/firm)
  counsel_reviewed_at  timestamptz,
  data_class           text NOT NULL DEFAULT 'S' CHECK (data_class IN ('S','T','P')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, bureau)
);

CREATE INDEX IF NOT EXISTS credit_freezes_child_idx ON public.credit_freezes (child_id);

-- Only counsel-approved rows may move past 'not_requested' — enforced in the
-- schema so no route can skip the gate.
ALTER TABLE public.credit_freezes DROP CONSTRAINT IF EXISTS credit_freeze_counsel_gate;
ALTER TABLE public.credit_freezes
  ADD CONSTRAINT credit_freeze_counsel_gate
  CHECK (
    freeze_status = 'not_requested'
    OR counsel_review_status = 'approved'
  );

-- ---------------------------------------------------------------------------
-- RLS: parents of the child only. Children get zero rows (freeze records are
-- a parent stewardship action under 13; shared-agency 13–17 sees status via
-- the parent surface, not this table directly).
-- ---------------------------------------------------------------------------
ALTER TABLE public.credit_freezes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_freezes_parent_read ON public.credit_freezes;
CREATE POLICY credit_freezes_parent_read ON public.credit_freezes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM unnest(public.current_child_ids()) AS c(cid)
            WHERE c.cid = public.credit_freezes.child_id)
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.child_id = public.credit_freezes.child_id
                  AND ca.user_id = auth.uid() AND ca.role = 'parent')
  );

DROP POLICY IF EXISTS credit_freezes_parent_insert ON public.credit_freezes;
CREATE POLICY credit_freezes_parent_insert ON public.credit_freezes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM unnest(public.current_child_ids()) AS c(cid)
            WHERE c.cid = public.credit_freezes.child_id)
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.child_id = public.credit_freezes.child_id
                  AND ca.user_id = auth.uid() AND ca.role = 'parent')
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS credit_freezes_parent_update ON public.credit_freezes;
CREATE POLICY credit_freezes_parent_update ON public.credit_freezes
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM unnest(public.current_child_ids()) AS c(cid)
            WHERE c.cid = public.credit_freezes.child_id)
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.child_id = public.credit_freezes.child_id
                  AND ca.user_id = auth.uid() AND ca.role = 'parent')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM unnest(public.current_child_ids()) AS c(cid)
            WHERE c.cid = public.credit_freezes.child_id)
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.child_id = public.credit_freezes.child_id
                  AND ca.user_id = auth.uid() AND ca.role = 'parent')
  );

GRANT SELECT, INSERT, UPDATE ON public.credit_freezes TO authenticated;
