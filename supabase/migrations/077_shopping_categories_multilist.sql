-- Migration 077: Shopping v2 — categories + multiple lists (Phase1-Shopping)
--
-- CATEGORIES: every item gets a store-section category (Produce, Dairy, Meat,
-- Pantry, Frozen, Household, Other). Existing rows backfill to 'Other' (the
-- API auto-suggests from the item name on new writes; the board lets the
-- family fix a suggestion in one tap).
--
-- MULTIPLE LISTS: the UNIQUE(owner_user_id) one-list-per-household rule is
-- retired. is_default marks the household's primary list (oldest existing
-- row per owner wins); GET /list keeps serving the default, /lists manages
-- the rest. Squad Village's shopping_list_shares (069) references
-- shopping_lists(id), so per-list sharing keeps working unchanged.

-- ---------------------------------------------------------------------------
-- item categories
-- ---------------------------------------------------------------------------
ALTER TABLE public.shopping_items
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Other'
  CHECK (category IN ('Produce','Dairy','Meat','Pantry','Frozen','Household','Other'));

CREATE INDEX IF NOT EXISTS shopping_items_list_category_idx
  ON public.shopping_items (list_id, category);

-- ---------------------------------------------------------------------------
-- multiple lists per household
-- ---------------------------------------------------------------------------
ALTER TABLE public.shopping_lists
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- The household's oldest list becomes its default (preserves the "one list"
-- behavior every existing route relies on).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY owner_user_id ORDER BY created_at) AS rn
  FROM public.shopping_lists
)
UPDATE public.shopping_lists l
SET is_default = true
FROM ranked r
WHERE l.id = r.id AND r.rn = 1;

-- Retire the one-list-per-household constraint.
ALTER TABLE public.shopping_lists
  DROP CONSTRAINT IF EXISTS shopping_lists_owner_user_id_key;

-- Belt and braces: exactly one default per owner (new lists are non-default).
CREATE UNIQUE INDEX IF NOT EXISTS shopping_lists_one_default_per_owner
  ON public.shopping_lists (owner_user_id)
  WHERE is_default;
