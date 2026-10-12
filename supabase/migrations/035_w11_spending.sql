-- Migration 025: W11 Spending — transactions, Plaid connection store, teen-privacy RLS (FR-MOD-W11)
--
-- Tenancy follows §2.1 THE DECISION: household tables anchor to owner_user_id
-- (the parent user). Plaid access tokens are encrypted blobs — never plaintext
-- (NFR-SEC-006). Account references are masked ("Chase …4471"); Plaid only
-- ever exposes masked numbers, and the schema mirrors that.
--
-- TEEN PRIVACY (FR-MOD-W11, spec §147): a teen's own purchase detail is
-- teen-private. Enforced in RLS, not the app:
--   - Line items: household members see rows where NOT is_teen_private, or
--     rows they purchased themselves (purchased_by = auth.uid()). A parent
--     NEVER sees a teen-private row's merchant/amount — RLS returns zero rows.
--   - Aggregates: parents call spending_summary() (SECURITY DEFINER,
--     parent-role checked inside) which returns per-category/per-month totals
--     with NO merchant line items.
-- Writes stamp purchased_by = auth.uid() explicitly; the RLS WITH CHECK makes
-- mis-attribution impossible from a client JWT.
--
-- Sources: 'manual' (hand entry), 'csv' (statement import), 'plaid' (bank sync).

-- ---------------------------------------------------------------------------
-- plaid_items: one row per linked Plaid Item (bank connection).
-- access_token_ciphertext is pgp_sym_encrypted with the app key (see 026's
-- vault helpers); the plaintext access token never touches this table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plaid_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- tenant key (household anchor)
  plaid_item_id           text NOT NULL UNIQUE,                -- Plaid's item_id (opaque, not secret)
  institution_name        text NOT NULL,                       -- e.g. 'Chase'
  access_token_ciphertext bytea NOT NULL,                      -- encrypted; see src/server/services/plaid.ts
  sync_cursor             text,                                -- transactions/sync cursor (null until first sync)
  status                  text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','error','revoked')),
  last_sync_at            timestamptz,
  last_error              text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plaid_items_owner_idx ON public.plaid_items (owner_user_id);

-- ---------------------------------------------------------------------------
-- spending_accounts: masked account references. account_ref is display text
-- only ("Chase Checking …4471") — Plaid never gives us the full number.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spending_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- tenant key
  plaid_item_id   uuid REFERENCES public.plaid_items(id) ON DELETE SET NULL,    -- NULL => manual/csv account
  plaid_account_id text,                                                        -- Plaid's account_id (opaque)
  account_ref     text NOT NULL,                                                 -- masked display: "Chase Checking …4471"
  name            text NOT NULL,
  type            text,                                                          -- depository / credit / loan / investment
  subtype         text,                                                          -- checking / savings / credit card / …
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spending_accounts_owner_idx ON public.spending_accounts (owner_user_id);

-- ---------------------------------------------------------------------------
-- transactions: the ledger. Immutable-ish: UPDATE allowed only for
-- category_override / is_teen_private correction by the purchaser; no DELETE
-- policy (ledger-like). amount > 0 = outflow, < 0 = inflow (Plaid convention).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- tenant key (household anchor)
  account_id           uuid REFERENCES public.spending_accounts(id) ON DELETE SET NULL,
  account_ref          text NOT NULL,                                     -- denormalized masked ref ("Chase …4471")
  amount               numeric(12,2) NOT NULL,                             -- >0 outflow, <0 inflow
  merchant             text,                                               -- masked-normalized display name
  category             text,                                               -- normalized primary category
  category_detailed    text,                                               -- Plaid detailed / source-specific
  category_override    text,                                               -- user correction; wins over category
  purchased_by         uuid NOT NULL REFERENCES public.users(id),         -- the purchaser (self-stamped)
  is_teen_private      boolean NOT NULL DEFAULT false,                    -- teen's own purchase detail: teen-private
  source               text NOT NULL DEFAULT 'manual'
                       CHECK (source IN ('manual','csv','plaid')),
  plaid_transaction_id text UNIQUE,                                       -- idempotency key for plaid syncs
  posted_date          date NOT NULL DEFAULT CURRENT_DATE,
  pending              boolean NOT NULL DEFAULT false,
  data_class           text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_owner_date_idx
  ON public.transactions (owner_user_id, posted_date DESC);
CREATE INDEX IF NOT EXISTS transactions_owner_category_idx
  ON public.transactions (owner_user_id, category);
CREATE INDEX IF NOT EXISTS transactions_owner_purchased_by_idx
  ON public.transactions (owner_user_id, purchased_by);

-- ---------------------------------------------------------------------------
-- W11 seams promised by 007/008: ledger_entry_id FKs. The columns already
-- exist; this migration adds the foreign keys (no cross-module FK was allowed
-- before the target table existed).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='mail_action_items' AND column_name='ledger_entry_id')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mail_action_items_ledger_entry_id_fkey') THEN
    ALTER TABLE public.mail_action_items
      ADD CONSTRAINT mail_action_items_ledger_entry_id_fkey
      FOREIGN KEY (ledger_entry_id) REFERENCES public.transactions(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='shopping_items' AND column_name='ledger_entry_id')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shopping_items_ledger_entry_id_fkey') THEN
    ALTER TABLE public.shopping_items
      ADD CONSTRAINT shopping_items_ledger_entry_id_fkey
      FOREIGN KEY (ledger_entry_id) REFERENCES public.transactions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS
-- plaid_items: owner-only (tokens are the crown jewels — even other household
-- members get zero rows; the app acts on them server-side via service_role).
-- spending_accounts / transactions: household members, with the teen-privacy
-- line-item gate on transactions (parents see aggregates via spending_summary).
-- ---------------------------------------------------------------------------
ALTER TABLE public.plaid_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spending_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions     ENABLE ROW LEVEL SECURITY;

-- plaid_items: owner-only, full row access.
DROP POLICY IF EXISTS plaid_items_owner_all ON public.plaid_items;
CREATE POLICY plaid_items_owner_all ON public.plaid_items
  FOR ALL USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- spending_accounts: household read; owner insert/update.
DROP POLICY IF EXISTS spending_accounts_household_read ON public.spending_accounts;
CREATE POLICY spending_accounts_household_read ON public.spending_accounts
  FOR SELECT USING (public.is_household_member(owner_user_id));

DROP POLICY IF EXISTS spending_accounts_owner_write ON public.spending_accounts;
CREATE POLICY spending_accounts_owner_write ON public.spending_accounts
  FOR ALL USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- transactions — the teen-privacy gate (FR-MOD-W11):
-- SELECT: household member AND (row is not teen-private OR the caller is the
-- purchaser). A parent querying for a teen's private rows gets ZERO rows —
-- not redacted rows. No amount/merchant leaks through aggregates of line
-- items; aggregates come only from spending_summary().
DROP POLICY IF EXISTS transactions_household_read ON public.transactions;
CREATE POLICY transactions_household_read ON public.transactions
  FOR SELECT USING (
    public.is_household_member(owner_user_id)
    AND (NOT is_teen_private OR purchased_by = auth.uid())
  );

-- INSERT: household member, self-stamped purchaser (mis-attribution impossible).
DROP POLICY IF EXISTS transactions_household_insert ON public.transactions;
CREATE POLICY transactions_household_insert ON public.transactions
  FOR INSERT WITH CHECK (
    public.is_household_member(owner_user_id)
    AND purchased_by = auth.uid()
  );

-- UPDATE: the purchaser may re-categorize / correct privacy on their own rows.
DROP POLICY IF EXISTS transactions_purchaser_update ON public.transactions;
CREATE POLICY transactions_purchaser_update ON public.transactions
  FOR UPDATE
  USING (purchased_by = auth.uid() AND public.is_household_member(owner_user_id))
  WITH CHECK (purchased_by = auth.uid() AND public.is_household_member(owner_user_id));

-- No DELETE policy by design — ledger-like (matches shopping/W20 convention).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plaid_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.spending_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;

-- ---------------------------------------------------------------------------
-- spending_summary(p_owner, p_from, p_to): parent-only aggregates.
-- Returns per-category totals + monthly totals + counts, INCLUDING teen-private
-- amounts, but NEVER merchant line items. This is the only sanctioned way a
-- parent sees teen spending — as aggregates, never as detail (FR-MOD-W11).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spending_summary(
  p_owner uuid,
  p_from date DEFAULT (CURRENT_DATE - interval '90 days')::date,
  p_to   date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_household_parent(p_owner) THEN
    RAISE EXCEPTION 'parent_membership_required';
  END IF;

  SELECT jsonb_build_object(
    'owner_user_id', p_owner,
    'from', p_from,
    'to', p_to,
    'total_outflow', COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
    'total_inflow',  COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0),
    'transaction_count', COUNT(*),
    'teen_private_count', COUNT(*) FILTER (WHERE is_teen_private),
    'by_category', COALESCE((
      SELECT jsonb_agg(row_to_json(c))
      FROM (
        SELECT COALESCE(category_override, category, 'uncategorized') AS category,
               SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS outflow,
               SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS inflow,
               COUNT(*) AS count
        FROM public.transactions
        WHERE owner_user_id = p_owner
          AND posted_date BETWEEN p_from AND p_to
        GROUP BY 1
        ORDER BY 2 DESC
      ) c
    ), '[]'::jsonb),
    'by_month', COALESCE((
      SELECT jsonb_agg(row_to_json(m))
      FROM (
        SELECT to_char(posted_date, 'YYYY-MM') AS month,
               SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS outflow,
               SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS inflow,
               COUNT(*) AS count
        FROM public.transactions
        WHERE owner_user_id = p_owner
          AND posted_date BETWEEN p_from AND p_to
        GROUP BY 1
        ORDER BY 1
      ) m
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.transactions
  WHERE owner_user_id = p_owner
    AND posted_date BETWEEN p_from AND p_to;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.spending_summary(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spending_summary(uuid, date, date) TO authenticated, service_role;
