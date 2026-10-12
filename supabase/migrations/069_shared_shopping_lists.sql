-- Migration 069: Shared Shopping Lists Between Families (Squad Village)
--
-- Two families can "link ships" on a shopping list: the owner shares their
-- household list with another family's user by email. Shared lists are LIVE —
-- anyone on the list can add items, claim them, and check them off.
-- Each item already tracks added_by / claimed_by / bought_by (007), so
-- attribution across families comes free.
--
-- Design:
--   shopping_list_shares: one row per (list, shared user). Owner manages.
--   Access predicate: household member OR active share recipient.
--   RLS uses additive permissive policies (Postgres ORs them).

-- ---------------------------------------------------------------------------
-- shopping_list_shares table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopping_list_shares (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id             uuid NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by_user_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS shopping_list_shares_user_idx
  ON public.shopping_list_shares (shared_with_user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS shopping_list_shares_list_idx
  ON public.shopping_list_shares (list_id) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- Access helper: household member OR active share recipient (STABLE, DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_shopping_list(p_list_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shopping_lists l
    WHERE l.id = p_list_id
      AND (
        public.is_household_member(l.owner_user_id)
        OR EXISTS (
          SELECT 1 FROM public.shopping_list_shares s
          WHERE s.list_id = l.id
            AND s.shared_with_user_id = auth.uid()
            AND s.status = 'active'
        )
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.shopping_list_shares ENABLE ROW LEVEL SECURITY;

-- Owner of the list manages shares; recipients can see their own share rows.
DROP POLICY IF EXISTS shopping_list_shares_owner_manage ON public.shopping_list_shares;
CREATE POLICY shopping_list_shares_owner_manage ON public.shopping_list_shares
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.shopping_lists l
            WHERE l.id = public.shopping_list_shares.list_id
              AND l.owner_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shopping_lists l
            WHERE l.id = public.shopping_list_shares.list_id
              AND l.owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS shopping_list_shares_recipient_read ON public.shopping_list_shares;
CREATE POLICY shopping_list_shares_recipient_read ON public.shopping_list_shares
  FOR SELECT USING (shared_with_user_id = auth.uid() AND status = 'active');

-- Recipients may leave a shared list (revoke their own share row).
DROP POLICY IF EXISTS shopping_list_shares_recipient_leave ON public.shopping_list_shares;
CREATE POLICY shopping_list_shares_recipient_leave ON public.shopping_list_shares
  FOR UPDATE USING (shared_with_user_id = auth.uid())
  WITH CHECK (shared_with_user_id = auth.uid() AND status = 'revoked');

-- Extend list/item visibility to share recipients (additive permissive policies).
DROP POLICY IF EXISTS shopping_lists_shared_read ON public.shopping_lists;
CREATE POLICY shopping_lists_shared_read ON public.shopping_lists
  FOR SELECT USING (public.can_access_shopping_list(id));

DROP POLICY IF EXISTS shopping_items_shared_read ON public.shopping_items;
CREATE POLICY shopping_items_shared_read ON public.shopping_items
  FOR SELECT USING (public.can_access_shopping_list(list_id));

DROP POLICY IF EXISTS shopping_items_shared_insert ON public.shopping_items;
CREATE POLICY shopping_items_shared_insert ON public.shopping_items
  FOR INSERT WITH CHECK (
    added_by = auth.uid()
    AND public.can_access_shopping_list(list_id)
  );

DROP POLICY IF EXISTS shopping_items_shared_update ON public.shopping_items;
CREATE POLICY shopping_items_shared_update ON public.shopping_items
  FOR UPDATE
  USING (public.can_access_shopping_list(list_id))
  WITH CHECK (public.can_access_shopping_list(list_id));

DROP POLICY IF EXISTS shopping_price_reports_shared_read ON public.shopping_price_reports;
CREATE POLICY shopping_price_reports_shared_read ON public.shopping_price_reports
  FOR SELECT USING (public.can_access_shopping_list(list_id));

DROP POLICY IF EXISTS shopping_price_reports_shared_insert ON public.shopping_price_reports;
CREATE POLICY shopping_price_reports_shared_insert ON public.shopping_price_reports
  FOR INSERT WITH CHECK (public.can_access_shopping_list(list_id));
