-- Migration 007: W20 shared shopping list + household helpers
-- Source: docs/MODULE-ARCHITECTURE.md §2.1 (THE DECISION), §2.2, §4.4
--
-- THE DECISION (spec §2.1): household tables anchor to owner_user_id (the
-- parent user) — one shopping_lists row per parent user. NO households table,
-- NO child_id column on shopping tables. Membership is DERIVED from
-- child_access via the helpers below, so child_access stays the single
-- source of truth. The tenant key is derived deterministically from
-- child_id — never client-supplied.
--
-- Household helpers defined here (008 builds on them):
--   public.household_owner_for_child(p_child_id)  — the household anchor for a child
--   public.is_household_member(p_owner)           — caller ∈ owner's household
--
-- W20 tables default data_class='T' (spec §4.4). Cross-module seams:
--   shopping_items.source / source_ref   — W13 seam (meal plans feed the list)
--   shopping_items.ledger_entry_id uuid  — W11 seam; the FK is added by W11's
--                                          migration, NOT here (no cross-module
--                                          FK before the target table exists).

-- ---------------------------------------------------------------------------
-- household_owner_for_child(p_child_id): the household anchor.
-- children.parent_user_id is the billing/owner anchor; when NULL, fall back
-- to the earliest parent-role child_access row for that child (spec §7 Q1).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.household_owner_for_child(p_child_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT c.parent_user_id FROM public.children c WHERE c.id = p_child_id),
    (SELECT ca.user_id
     FROM public.child_access ca
     WHERE ca.child_id = p_child_id AND ca.role = 'parent'
     ORDER BY ca.created_at ASC
     LIMIT 1)
  )
$$;

REVOKE ALL ON FUNCTION public.household_owner_for_child(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.household_owner_for_child(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- is_household_member(p_owner): the caller may see owner's household data iff
-- they ARE the owner, or any child in their tenant set anchors to p_owner.
-- The second arm funnels through current_child_ids() — the same single
-- funnel as every child_id policy — so agents (job-scoped), children, and
-- co-parents resolve correctly; anon gets nothing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_household_member(p_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_owner = auth.uid()  -- owners always see their own list
      OR EXISTS (SELECT 1 FROM unnest(public.current_child_ids()) AS c(cid)
                 WHERE public.household_owner_for_child(c.cid) = p_owner)
$$;

REVOKE ALL ON FUNCTION public.is_household_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- shopping_lists: one row per household (UNIQUE on the owner anchor)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,  -- the tenant key (household anchor)
  name          text NOT NULL DEFAULT 'Family shopping list',
  preferences   jsonb NOT NULL DEFAULT '{}'::jsonb,   -- preferred stores, standing rules
  data_class    text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- shopping_items: states needed -> claimed -> bought (+ removed, ledger-like,
-- no hard deletes). Forward-only transitions enforced in the API route, not here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopping_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id        uuid NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  name           text NOT NULL,                         -- normalized lowercase at write (API)
  quantity       numeric(8,2) DEFAULT 1,
  unit           text,                                  -- e.g. 'gal', 'pk'
  note           text,                                  -- e.g. 'oat, not dairy'
  status         text NOT NULL DEFAULT 'needed'
                 CHECK (status IN ('needed','claimed','bought','removed')),
  added_by       uuid REFERENCES public.users(id),      -- who added it
  claimed_by     uuid REFERENCES public.users(id),
  bought_by      uuid REFERENCES public.users(id),
  bought_at      timestamptz,
  store          text,                                  -- where bought
  price_paid     numeric(10,2),                         -- actual — feeds W11 later
  source         text NOT NULL DEFAULT 'manual'
                 CHECK (source IN ('manual','meal-plan','recurring','ai-suggestion')),  -- W13 seam
  source_ref     jsonb,                                 -- e.g. {"meal_plan_id":"…","week":"…"} — W13 seam
  ledger_entry_id uuid,                                 -- W11 seam: FK added by W11's migration, not here
  data_class     text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopping_items_list_status_idx
  ON public.shopping_items (list_id, status);
CREATE INDEX IF NOT EXISTS shopping_items_list_name_idx
  ON public.shopping_items (list_id, lower(name));

-- ---------------------------------------------------------------------------
-- shopping_price_reports: user-reported price memory. Append-only (ledger):
-- no UPDATE/DELETE policies or grants — price history is immutable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopping_price_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id        uuid NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  item_name      text NOT NULL,                         -- normalized lowercase
  store          text NOT NULL,
  price          numeric(10,2) NOT NULL CHECK (price >= 0),
  reported_by    uuid REFERENCES public.users(id),
  reported_at    date NOT NULL DEFAULT CURRENT_DATE,
  receipt_item_id uuid REFERENCES public.shopping_items(id) ON DELETE SET NULL,  -- learned from a bought item
  data_class     text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopping_price_reports_list_item_store_idx
  ON public.shopping_price_reports (list_id, item_name, store, reported_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: household-scoped via is_household_member()
-- ---------------------------------------------------------------------------
ALTER TABLE public.shopping_lists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_price_reports ENABLE ROW LEVEL SECURITY;

-- shopping_lists: SELECT by any household member; INSERT/UPDATE/DELETE
-- owner-only (agents/workers use service_role, which bypasses RLS).
DROP POLICY IF EXISTS shopping_lists_household_read ON public.shopping_lists;
CREATE POLICY shopping_lists_household_read ON public.shopping_lists
  FOR SELECT USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS shopping_lists_owner_write ON public.shopping_lists;
CREATE POLICY shopping_lists_owner_write ON public.shopping_lists
  FOR ALL USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- shopping_items: SELECT/INSERT/UPDATE via the household predicate (join on
-- list_id). INSERT additionally requires added_by = auth.uid() (service_role
-- bypasses for the W13 worker batch path). No DELETE policy by design —
-- removal is status='removed' (ledger-like, matches the invites/access_requests
-- convention). Parent-only delete of OTHERS' items is enforced in the route.
DROP POLICY IF EXISTS shopping_items_household_read ON public.shopping_items;
CREATE POLICY shopping_items_household_read ON public.shopping_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.shopping_lists l
            WHERE l.id = public.shopping_items.list_id
              AND public.is_household_member(l.owner_user_id))
  );

DROP POLICY IF EXISTS shopping_items_household_insert ON public.shopping_items;
CREATE POLICY shopping_items_household_insert ON public.shopping_items
  FOR INSERT WITH CHECK (
    added_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.shopping_lists l
                WHERE l.id = public.shopping_items.list_id
                  AND public.is_household_member(l.owner_user_id))
  );

DROP POLICY IF EXISTS shopping_items_household_update ON public.shopping_items;
CREATE POLICY shopping_items_household_update ON public.shopping_items
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.shopping_lists l
            WHERE l.id = public.shopping_items.list_id
              AND public.is_household_member(l.owner_user_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shopping_lists l
            WHERE l.id = public.shopping_items.list_id
              AND public.is_household_member(l.owner_user_id))
  );

-- shopping_price_reports: household SELECT/INSERT; append-only (no UPDATE/DELETE).
DROP POLICY IF EXISTS shopping_price_reports_household_read ON public.shopping_price_reports;
CREATE POLICY shopping_price_reports_household_read ON public.shopping_price_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.shopping_lists l
            WHERE l.id = public.shopping_price_reports.list_id
              AND public.is_household_member(l.owner_user_id))
  );

DROP POLICY IF EXISTS shopping_price_reports_household_insert ON public.shopping_price_reports;
CREATE POLICY shopping_price_reports_household_insert ON public.shopping_price_reports
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.shopping_lists l
            WHERE l.id = public.shopping_price_reports.list_id
              AND public.is_household_member(l.owner_user_id))
  );

-- ---------------------------------------------------------------------------
-- Explicit GRANTs (least privilege). No DELETE grant on shopping_items or
-- shopping_price_reports — ledger-like by design. No anon grants.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.shopping_items TO authenticated;
GRANT SELECT, INSERT ON public.shopping_price_reports TO authenticated;
