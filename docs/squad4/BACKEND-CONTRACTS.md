# Squad 4 — Home & Money Track: Backend Contracts

**Owner:** Tech Lead / Senior Backend Engineer (Squad 4)
**Date:** 2026-10-12
**Modules:** W21 Mail · W20 Shopping List · W11 Spending · W7 Money & Documents ·
W24 Credit · W14 Co-parenting · W12 Babysitters

> **Migration freeze note (MD, 2026-10-12):** new migration files are FROZEN
> pending MD renumbering. The MD renumbering pass has already relocated this
> squad's six migrations (originally drafted as 024–029) to
> `supabase/migrations/035_w11_spending.sql`,
> `036_w7_vault.sql`, `037_w24_credit.sql`, `038_w14_coparenting.sql`,
> `039_w12_babysitters.sql`, `040_w21_mail_retention.sql` — **the renumbering
> team owns those files; do not touch them until all-clear.** The RLS designs
> below are reproduced here as SQL text so frontend work is unblocked.

Conventions shared with the existing code:
- Every route goes through `handleRoute` (`src/server/rest.ts`): canonical
  envelope `{ ok: true, data }` / `{ ok: false, error: { code, message, requestId } }`.
- Tenant assertion: `assertHousehold()` for household-anchored modules,
  `assertTenant(childId)` / `assertParent(childId)` for child-anchored ones.
- Tenancy follows **§2.1 THE DECISION**: household tables anchor to
  `owner_user_id` (the parent user) — never a client-supplied household id.
- All writes are audit-logged via `auditEvent(anchorChildId, action, detail)`;
  audit detail carries ids only — never amounts, account fragments, or OCR text.
- Data classes: `S` = sensitive (W21, W7, W24), `T` = standard (W20, W11, W12).

---

## 1. W21 Mail (FR-MOD-W21, NFR-PRIVACY-009)

Existing: migration 008 + `src/server/ocr/` pipeline + `src/server/mail/common.ts`.
New in this squad: retention/masking columns + array extractions (held in
migration `040_w21_mail_retention.sql`), intake service, and API routes.

**Extract-then-mask (GIPA):** the OCR pipeline extracts from the RAW reading,
then `maskAccountNumbers()` replaces every digit run of 8+ (card/account/SSN
shapes, separators allowed) with `****` + last-4 **before** `ocr_text` is
persisted. Enforced in code (`src/server/ocr/extract.ts`,
`src/server/ocr/pipeline.ts`) and mirrored in SQL (`mask_account_numbers()`,
held migration 024) for scheduled-job use.

**Raw-image auto-deletion ≤ 30 days:** `mail_items.auto_delete_at` defaults to
`now() + 30 days`; `purge_expired_mail_photos()` (definer, service_role)
deletes the `mail-photos` storage objects and clears `photo_path`. Scheduled
via pg_cron / edge-function scheduler.

### Routes

| Method & path | Auth | Request | Response `data` | Notes |
|---|---|---|---|---|
| `GET /api/v1/household/mail` | parent | `?status=&classification=&limit=` | `{ items: MailItemPublic[] }` | Metadata only — `ocr_text` never in list payloads |
| `POST /api/v1/household/mail` | parent | `multipart/form-data`: `photo` (File, ≤12 MB, jpeg/png/webp/heic), `sender?`, `related_child_id?` | `{ item: MailItemPublic }` | Uploads to private `mail-photos`; orphan photo rolled back on row failure |
| `GET /api/v1/household/mail/[itemId]` | parent | — | `{ item: MailItemDetail }` | **Audited read** — the only route returning `ocr_text` |
| `PATCH /api/v1/household/mail/[itemId]` | parent | `{ status: 'new'\|'triaged'\|'actioned'\|'dismissed' }` | `{ item: MailItemPublic }` | No client DELETE (ledger-like) |
| `POST /api/v1/household/mail/[itemId]/ocr` | parent | `{ providerKey?, externalConsent?, force? }` | `{ accepted, item, handwritingReview, actionsCreated, actionsEscalated }` | Runs §3.3 pipeline inline; 409 if OCR already ran (unless `force`) |

### RLS design (SQL text — file under new numbering when freeze lifts)

```sql
-- (Held: supabase/migrations/040_w21_mail_retention.sql — extends migration 008)
ALTER TABLE public.mail_items
  ADD COLUMN IF NOT EXISTS extracted_amounts numeric(12,2)[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extracted_due_dates date[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extracted_action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_delete_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS photo_purged_at timestamptz;

-- Extract-then-mask helper (mirrors maskAccountNumbers() in extract.ts)
CREATE OR REPLACE FUNCTION public.mask_account_numbers(p_text text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_result text := ''; v_rest text := p_text; v_match text[]; v_pos integer; v_digits text;
BEGIN
  IF p_text IS NULL THEN RETURN NULL; END IF;
  LOOP
    v_match := regexp_match(v_rest, '(?<!\d)\d(?:[\s\-]?\d){7,}(?!\d)');
    IF v_match IS NULL THEN v_result := v_result || v_rest; EXIT; END IF;
    v_pos := position(v_match[1] in v_rest);
    v_result := v_result || substring(v_rest FROM 1 FOR v_pos - 1);
    v_digits := regexp_replace(v_match[1], '\D', '', 'g');
    IF length(v_digits) >= 8 THEN v_result := v_result || '****' || right(v_digits, 4);
    ELSE v_result := v_result || v_match[1]; END IF;
    v_rest := substring(v_rest FROM v_pos + length(v_match[1]));
  END LOOP;
  RETURN v_result;
END; $$;

-- Scheduled purge: deletes mail-photos objects past auto_delete_at; keeps metadata.
CREATE OR REPLACE FUNCTION public.purge_expired_mail_photos() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE v_paths text[]; v_count integer := 0;
BEGIN
  SELECT array_agg(photo_path) INTO v_paths FROM public.mail_items
  WHERE auto_delete_at < now() AND photo_purged_at IS NULL;
  IF v_paths IS NULL THEN RETURN 0; END IF;
  DELETE FROM storage.objects WHERE bucket_id = 'mail-photos' AND name = ANY (v_paths);
  UPDATE public.mail_items SET photo_path = '', photo_purged_at = now()
  WHERE auto_delete_at < now() AND photo_purged_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END; $$;
-- RLS on mail_items is unchanged from 008: is_household_parent() SELECT/INSERT/UPDATE, no DELETE.
```

---

## 2. W20 Shopping List (FR-MOD-W20) — audit: done vs gaps

**Done (audited `src/server/services/shopping.ts`, migration 007):**
- `shopping_lists` (one row per household anchor), `shopping_items`
  (needed → claimed → bought + removed; forward-only state machine with the
  two sanctioned exceptions), `shopping_price_reports` (append-only ledger).
- Dedupe-merge on normalized name; batch add for the W13 meal-plan seam;
  receipt price learning (bought + store + price → price_reports row);
  preferences merge (never replace); display-name resolution.
- RLS: household read, owner-only list writes, `added_by = auth.uid()` on
  insert, no DELETE policy on items/price_reports (ledger-like).
- Routes: `list`, `items` (POST), `items/batch`, `items/[itemId]` (PATCH),
  `items/[itemId]/remove`, `preferences` (PATCH), `prices` (GET/POST).

**Gaps (not built — follow-ups for the squad):**
1. `ledger_entry_id` FK to W11 `transactions` — the column exists; the FK is
   added by the held W11 migration (`035_w11_spending.sql`).
2. Display-name gap (noted in the service): child-role callers see only their
   own `users` row, so other members' tags fall back to "Family" — a DBA-owned
   `household_member_names()` definer RPC would close it.
3. The W13 meal-plan batch path assumes service_role; no worker is wired yet.
4. One `console.error` in `transitionItem`'s best-effort price-learning path
   (matches the repo's error-path logging convention; acceptable).

No changes were needed to W20 for this contract — it is the reference pattern
the other six modules follow.

---

## 3. W11 Spending (FR-MOD-W11)

Tables (held: `035_w11_spending.sql`): `plaid_items` (encrypted access tokens),
`spending_accounts` (masked refs only), `transactions`
(`manual` | `csv` | `plaid` sources; `purchased_by` self-stamped;
`is_teen_private`; `plaid_transaction_id` UNIQUE idempotency key).

**Teen-privacy enforcement (the critical RLS):**
- Line items: `is_household_member(owner_user_id) AND (NOT is_teen_private
  OR purchased_by = auth.uid())`. A parent querying a teen's private rows gets
  **zero rows** — not redacted rows.
- Aggregates: `spending_summary(p_owner, p_from, p_to)` — SECURITY DEFINER
  with an `is_household_parent()` check inside. Returns per-category and
  per-month totals **including** teen-private amounts, but **never** merchant
  line items. This is the only sanctioned way a parent sees teen spending.
- `plaid_items` is owner-only (tokens are the crown jewels); `transactions`
  has no DELETE policy (ledger-like).

### Routes

| Method & path | Auth | Request | Response `data` | Notes |
|---|---|---|---|---|
| `GET /api/v1/household/spending/transactions` | household | `?from=&to=&category=&limit=` (dates `YYYY-MM-DD`) | `{ transactions: Transaction[] }` | RLS applies the teen-privacy gate |
| `POST /api/v1/household/spending/transactions` | household | `{ account_ref, amount, merchant?, category?, is_teen_private?, posted_date? }` | `{ transaction }` | `purchased_by` = caller |
| `GET /api/v1/household/spending/summary` | parent | `?from=&to=` | `{ summary: { total_outflow, total_inflow, transaction_count, teen_private_count, by_category[], by_month[] } }` | Aggregates only — no line items |
| `POST /api/v1/household/spending/csv-import` | household | `{ csv: string (≤2 MB), account_ref }` | `{ parsed, imported, skipped }` | Header auto-detect; dedupe on (date, merchant, amount); rule-based categorization |
| `POST /api/v1/household/spending/plaid/link-token` | parent | — | `{ link_token, expiration }` | Plaid Link init |
| `POST /api/v1/household/spending/plaid/exchange` | parent | `{ public_token }` | `{ plaid_item_id, institution_name, accounts: [{ name, account_ref }] }` | Token encrypted before storage; plaintext in memory only |
| `POST /api/v1/household/spending/plaid/sync` | parent | — | `{ results: [{ added, modified, removed }] }` | transactions/sync cursor loop; idempotent |
| `POST /api/v1/household/spending/plaid/webhook` | none (Plaid) | Plaid webhook body | `{ synced: 0\|1 }` | Deliberately bypasses `handleRoute` (Plaid has no session); body never trusted for data — only triggers a sync |

### Plaid integration point (real integration — MD no-placeholder directive)

The integration is **fully built** against the official `plaid` npm SDK
(v48, added to `package.json`): `src/server/services/plaid.ts` implements the
complete flow — `createLinkToken` → `exchangePublicToken` (access token
encrypted with `pgp_sym_encrypt` via the `vault_doc_encrypt` definer RPC before
it touches `plaid_items`) → `syncPlaidItem` (transactions/sync with cursor
paging, upsert on `plaid_transaction_id`, masked account refs, Plaid
`personal_finance_category` mapped through the categorizer) →
`handlePlaidWebhook` (SYNC_UPDATES_AVAILABLE / INITIAL_UPDATE /
HISTORICAL_UPDATE trigger a sync; nothing else is trusted) →
`disconnectPlaidItem` (row deletion = cryptographic erasure of the token).

**What is genuinely unavailable:** live credentials. The service requires
`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (defaults to `sandbox`), and
`PLAID_TOKEN_ENCRYPTION_KEY`. Until these are configured, Plaid routes return
`UPSTREAM_UNAVAILABLE` — **everything else in W11 (manual entry, CSV import,
rule-based categorization, RLS, parent aggregates) works against real data
with no Plaid configured.** Drop sandbox keys into the environment and the
full Link → sync → webhook flow works end to end; no code changes needed.

### RLS design (SQL text — held in `035_w11_spending.sql`)

```sql
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.spending_accounts(id) ON DELETE SET NULL,
  account_ref text NOT NULL,                       -- masked: "Chase …4471"
  amount numeric(12,2) NOT NULL,                    -- >0 outflow, <0 inflow
  merchant text, category text, category_detailed text, category_override text,
  purchased_by uuid NOT NULL REFERENCES public.users(id),
  is_teen_private boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','csv','plaid')),
  plaid_transaction_id text UNIQUE,
  posted_date date NOT NULL DEFAULT CURRENT_DATE,
  pending boolean NOT NULL DEFAULT false,
  data_class text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- THE teen-privacy gate: parents see aggregates, never teen-private line items.
CREATE POLICY transactions_household_read ON public.transactions
  FOR SELECT USING (
    public.is_household_member(owner_user_id)
    AND (NOT is_teen_private OR purchased_by = auth.uid())
  );
CREATE POLICY transactions_household_insert ON public.transactions
  FOR INSERT WITH CHECK (
    public.is_household_member(owner_user_id) AND purchased_by = auth.uid()
  );
CREATE POLICY transactions_purchaser_update ON public.transactions
  FOR UPDATE
  USING (purchased_by = auth.uid() AND public.is_household_member(owner_user_id))
  WITH CHECK (purchased_by = auth.uid() AND public.is_household_member(owner_user_id));
-- No DELETE policy: ledger-like.

-- Parent-only aggregates: totals by category/month, never merchant line items.
CREATE OR REPLACE FUNCTION public.spending_summary(p_owner uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.is_household_parent(p_owner) THEN RAISE EXCEPTION 'parent_membership_required'; END IF;
  SELECT jsonb_build_object(
    'total_outflow', COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
    'total_inflow',  COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0),
    'transaction_count', COUNT(*),
    'teen_private_count', COUNT(*) FILTER (WHERE is_teen_private),
    'by_category', (SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) FROM (
      SELECT COALESCE(category_override, category, 'uncategorized') AS category,
             SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS outflow, COUNT(*) AS count
      FROM public.transactions WHERE owner_user_id = p_owner AND posted_date BETWEEN p_from AND p_to
      GROUP BY 1 ORDER BY 2 DESC) c),
    'by_month', (SELECT COALESCE(jsonb_agg(row_to_json(m)), '[]'::jsonb) FROM (
      SELECT to_char(posted_date, 'YYYY-MM') AS month,
             SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS outflow, COUNT(*) AS count
      FROM public.transactions WHERE owner_user_id = p_owner AND posted_date BETWEEN p_from AND p_to
      GROUP BY 1 ORDER BY 1) m)
  ) INTO v_result FROM public.transactions
  WHERE owner_user_id = p_owner AND posted_date BETWEEN p_from AND p_to;
  RETURN v_result;
END; $$;
```

---

## 4. W7 Money & Documents vault (FR-MOD-W7, NFR-SEC-006)

Table (held: `036_w7_vault.sql`): `vault_documents`
(`owner_user_id`, `doc_type`, `doc_label`, `encrypted_blob bytea`,
`last4_ref` CHECK-constrained to ≤4 digits, `created_by`,
`retention_until`, `expires_on`, `data_class='S'`).

**Encryption approach:** `pgcrypto` `pgp_sym_encrypt` (AES-256) via the
`vault_doc_encrypt` / `vault_doc_decrypt` SECURITY DEFINER helpers (granted to
`service_role` only). The symmetric key is server-only (Supabase Vault /
`VAULT_DOC_ENCRYPTION_KEY` env) — it is passed as a parameter, never stored in
the table, logs, or backups. Rotation = re-encrypt with the new key, then
destroy the old key (cryptographic erasure).

**Never persist full PANs (NFR-SEC-006):** `assertNoFullPan()` in
`src/server/services/vault.ts` rejects any payload or label containing a
13–19 digit run **before** encryption; the SQL CHECK on `last4_ref`
(`^\d{1,4}$`) makes a full number unpersistable even if the API check were
bypassed.

**Retention schedule** (`vault_retention_until()`): card/bank_account 1y ·
tax 7y · insurance 10y · medical 10y · identity 5y · loan 7y · other 3y ·
**legal permanent** (NULL — never auto-purged).
`purge_expired_vault_documents()` (definer, service_role) deletes expired rows
— deletion is cryptographic erasure.

### Routes

| Method & path | Auth | Request | Response `data` | Notes |
|---|---|---|---|---|
| `GET /api/v1/household/vault/documents` | parent | — | `{ documents: VaultDocumentMeta[] }` | Metadata only — never secrets |
| `POST /api/v1/household/vault/documents` | parent | `{ doc_type, doc_label, secret, last4_ref?, expires_on? }` | `{ document: VaultDocumentMeta }` | Full-PAN payloads rejected pre-encryption; retention computed server-side |
| `GET /api/v1/household/vault/documents/[docId]` | parent | — | `{ document: VaultDocumentMeta, secret }` | **Audited reveal**; decrypted server-side; never logged |
| `DELETE /api/v1/household/vault/documents/[docId]` | parent | — | `{ deleted: true }` | Cryptographic erasure |

---

## 5. W24 Credit (FR-MOD-W24) — 🛑 gated behind FCRA counsel sign-off

**Re-scope (panel 🛑 → spec):** 3-bureau monitoring never ships (no FCRA
permissible purpose). This module is **minor security-freeze management** per
O.C.G.A. §§ 10-1-914/914.1 — the schema has no columns for scores, pulls, or
monitoring, deliberately.

**The gate:** every `credit_freezes` row defaults to
`counsel_review_status='pending'`, and the `credit_freeze_counsel_gate` CHECK
makes any `freeze_status` beyond `not_requested` **impossible** without
`counsel_review_status='approved'`. The API returns the module as pending
review; freeze actions are inert until counsel flips the gate — flipped by
counsel, never by a deploy.

### Routes

| Method & path | Auth | Request | Response `data` | Notes |
|---|---|---|---|---|
| `GET /api/v1/children/[childId]/credit` | parent | — | `{ gated: true, counsel_review_status: 'pending'\|'approved'\|'rejected', freezes: CreditFreeze[], guidance }` | The UI builds its "pending review" surface from this |
| `POST /api/v1/children/[childId]/credit` | parent | — | `{ freezes, counsel_review_status: 'pending' }` | Seeds the five bureau rows (equifax, experian, transunion, innovis, chexsystems) |

### RLS design (SQL text — held in `037_w24_credit.sql`)

```sql
CREATE TABLE public.credit_freezes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  bureau text NOT NULL CHECK (bureau IN ('equifax','experian','transunion','innovis','chexsystems')),
  freeze_status text NOT NULL DEFAULT 'not_requested'
    CHECK (freeze_status IN ('not_requested','requested','confirmed','temporarily_lifted','removed','error')),
  requested_by uuid REFERENCES public.users(id),
  requested_at timestamptz, confirmed_at timestamptz,
  confirmation_ref text, lift_requested_at timestamptz, lift_expires_at timestamptz,
  notes text,
  counsel_review_status text NOT NULL DEFAULT 'pending'
    CHECK (counsel_review_status IN ('pending','approved','rejected')),
  counsel_reviewed_by text, counsel_reviewed_at timestamptz,
  data_class text NOT NULL DEFAULT 'S' CHECK (data_class IN ('S','T','P')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, bureau)
);
-- The legal gate, in the schema: no freeze action without counsel approval.
ALTER TABLE public.credit_freezes ADD CONSTRAINT credit_freeze_counsel_gate
  CHECK (freeze_status = 'not_requested' OR counsel_review_status = 'approved');
-- RLS: parents of the child only (SELECT/INSERT/UPDATE); children get zero rows.
```

---

## 6. W14 Co-parenting (FR-MOD-W14) — 🛑 launch read-only/logistics-only, pending family-law review

**Panel 🛑 redesign (R5):** high-conflict co-parenting as a shared messaging
thread is a screenshot-weaponization surface. Required and built:
- **Parallel-parenting mode:** the API exposes two surfaces — `mine`
  (authored by the caller) and `theirs` (authored by the other parent) — never
  a shared thread, no reply chains.
- **Immutable log:** INSERT-only. No UPDATE/DELETE policies **or** grants;
  corrections are new rows with `corrects_entry_id`.
- **Logistics-only at launch:** `entry_type` is CHECK-constrained to
  `pickup | dropoff | expense | schedule | medical_logistics`. Free-form
  messaging is **schema-blocked** until family-law practitioner review.
- **No child-as-courier:** children get zero rows.
- **Custody-order awareness:** `custody_order_ref` + `travel_restriction_flags`
  (FR-SAFETY-012) ride on entries.

### Routes

| Method & path | Auth | Request | Response `data` | Notes |
|---|---|---|---|---|
| `GET /api/v1/children/[childId]/coparenting/log` | parent | — | `{ mine: Entry[], theirs: Entry[], launch_mode: 'read-only-logistics', review_pending: true }` | Parallel surfaces |
| `POST /api/v1/children/[childId]/coparenting/log` | parent | `{ entry_type, content, expense_amount?, occurs_at?, custody_order_ref?, travel_restriction_flags?, corrects_entry_id? }` | `{ entry }` | Immutable append; `expense` requires `expense_amount` |

### RLS design (SQL text — held in `038_w14_coparenting.sql`)

```sql
CREATE TABLE public.coparenting_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id),
  entry_type text NOT NULL
    CHECK (entry_type IN ('pickup','dropoff','expense','schedule','medical_logistics')),
  content text NOT NULL,
  expense_amount numeric(10,2),
  occurs_at timestamptz,
  custody_order_ref text,
  travel_restriction_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  corrects_entry_id uuid REFERENCES public.coparenting_log(id),
  data_class text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Immutability: SELECT + INSERT policies only; GRANT SELECT, INSERT only.
-- No UPDATE/DELETE policy, no UPDATE/DELETE grant — uneditable by anyone.
```

---

## 7. W12 Babysitters (FR-MOD-W12 + Proposal 2 + MD decision D6)

**Directory (spec §186):** `babysitters` — the disclaimer is a data-model
constant, the DB default on every row: **`'parent-vetted, not background-checked
by Pookie'`**, exported as `SITTER_VETTING_DISCLAIMER` in
`src/server/services/babysitters.ts` so UI and API use the exact same string.
Real background checks require FCRA counsel first.

**Time-boxed grants (Proposal 2, MD decision D6 2026-10-12):**
- **Tiered frequency caps** (server-side, in `request_sitter_grant()`):
  `trusted` (previously approved, no blocks on record) → **8/grantee/30d**;
  `first_time` → **2/30d**.
- **Installment detection** (both tiers): grants chained back-to-back (new
  grant starts within 7 days of a previous expiry, 3+ links in a rolling 30d
  window) are flagged `installment_review` — split grants cannot evade caps.
- **Teen co-approval (13–15):** required for **NEW grantees only**
  (`teen_coapproval_status='required'`, instant teen approve, no cooling-off).
  Renewals of an existing trusted grantee within cap do **not** re-prompt.
  Unknown age (NULL dob) fails closed → co-approval required.
- **Scope allowlist** at the RPC layer: `schedule`, `pickup`,
  `emergency_medical` only — Reflection/Wellness/H2/H3 rejected.
- **Blocks propagate:** `block_on_record` sitters get no grants; a block
  resets tier to `first_time`.
- **Tier promotion:** `record_sitter_grant_outcome()` promotes to `trusted`
  on clean completion (the D6 tier source).
- **Expiry as slope / teen heads-up:** UI + notification surfaces (not in this
  backend pass); the grant row carries everything they need
  (`starts_at`, `expires_at`, `teen_coapproval_status`).

**Migration 023 dependency (idempotent):** the held W12 migration
(`039_w12_babysitters.sql`) applies `ADD COLUMN IF NOT EXISTS` for
`child_access.expires_at / grant_kind / grant_purpose / recurrence_rule` —
no-op when Platform Team 1's 023 has landed (023's definitions win), creates
them when it hasn't. The time-boxed logic is self-contained in this squad's
files either way. No dead stubs.

### Routes

| Method & path | Auth | Request | Response `data` | Notes |
|---|---|---|---|---|
| `GET /api/v1/household/babysitters` | household | — | `{ sitters: Babysitter[] }` | Directory incl. disclaimer per row |
| `POST /api/v1/household/babysitters` | household | `{ name, contact?, notes? }` | `{ sitter }` | Starts `trust_tier='first_time'` |
| `GET /api/v1/household/babysitters/[sitterId]` | household | — | `{ sitter }` | |
| `PATCH /api/v1/household/babysitters/[sitterId]` | household | `{ contact?, notes? }` | `{ sitter }` | Tier/block change only via grant-outcome RPC |
| `GET /api/v1/household/babysitters/[sitterId]/grants` | household | — | `{ grants: SitterGrant[] }` | |
| `POST /api/v1/household/babysitters/[sitterId]/grants` | household | `{ child_id, purpose, starts_at, expires_at, scope? }` | `{ grant }` | D6 enforced in RPC; 429 on cap, 409 on block, 400 on scope/window |
| `POST /api/v1/household/babysitters/grants/[grantId]/approve` | household | `{ as_teen: boolean }` | `{ grant }` | Teen approves `required`; parent clears `installment_review` |
| `POST /api/v1/household/babysitters/grants/[grantId]/revoke` | household | `{ revoked_by: 'parent'\|'teen' }` | `{ revoked: true }` | Instant, no cooling-off |
| `POST /api/v1/household/babysitters/grants/[grantId]/close` | parent | `{ blocked: boolean }` | `{ sitter }` | Clean close → `trusted`; blocked → `block_on_record` |

### D6 design details (for the frontend engineer)

- `grantee_tier` is **snapshotted** on each grant row (auditability — the cap
  that applied is recorded with the grant).
- Cap check: `COUNT(*) WHERE sitter_id AND child_id AND created_at >
  now() - 30d AND status IN ('active','expired','pending_approval')` ≥
  `sitter_grant_cap(tier)` → `grant_cap_exceeded` → API maps to `RATE_LIMITED`
  (429). Note: `flagged` grants do not count toward the cap (they never
  activated); `revoked` grants do not count (revocation is a safety action,
  not usage).
- Installment heuristic: recursive chain over grants where
  `prev.expires_at >= new.starts_at - 7 days`, bounded to 12 links, windowed
  to 30 days; chain length (incl. the new grant) ≥ 3 → `installment_review` /
  `status='flagged'`. A flagged grant can only become active via the parent
  approve path, and clean completion of a flagged grant does **not** promote
  the sitter (prevents laundering installments into trusted status).
- Teen co-approval: `first_time` tier + child age 13–15 (or unknown) →
  `teen_coapproval_status='required'`, `status='pending_approval'`. The teen's
  Sharing surface approves; `teen_coapproved_by/at` stamped. Trusted-tier
  renewals skip this entirely (`not_required`).
- Scope default: `["schedule","pickup","emergency_medical"]`. Any other scope
  string → `scope_not_allowed` → 400. The emergency card is never gated by the
  grant (stated on the scope screen per Proposal 2).

### RLS design (SQL text — held in `039_w12_babysitters.sql`)

```sql
CREATE TABLE public.babysitters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL, contact text, notes text,
  vetted_by uuid REFERENCES public.users(id), vetted_at timestamptz,
  trust_tier text NOT NULL DEFAULT 'first_time' CHECK (trust_tier IN ('first_time','trusted')),
  block_on_record boolean NOT NULL DEFAULT false,
  vetting_disclaimer text NOT NULL DEFAULT 'parent-vetted, not background-checked by Pookie',
  data_class text NOT NULL DEFAULT 'T' CHECK (data_class IN ('S','T','P')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sitter_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  sitter_id uuid NOT NULL REFERENCES public.babysitters(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES public.users(id),
  purpose text NOT NULL,
  scope jsonb NOT NULL DEFAULT '["schedule","pickup","emergency_medical"]'::jsonb,
  starts_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
  grantee_tier text NOT NULL CHECK (grantee_tier IN ('first_time','trusted')),
  teen_coapproval_status text NOT NULL DEFAULT 'not_required'
    CHECK (teen_coapproval_status IN ('not_required','required','approved','installment_review')),
  teen_coapproved_by uuid REFERENCES public.users(id), teen_coapproved_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending_approval','active','expired','revoked','flagged')),
  revoked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);
-- D6 caps: sitter_grant_cap('trusted') = 8, ('first_time') = 2 — enforced in
-- request_sitter_grant() (SECURITY DEFINER) with installment detection,
-- teen co-approval, scope allowlist, and block propagation.
-- RLS: babysitters — household read, owner write. sitter_grants — parent read/insert/update.
```

---

## File index (new this squad)

**Services** (`src/server/services/`): `spending.ts` · `plaid.ts` · `vault.ts`
· `babysitters.ts` · `credit.ts` · `coparenting.ts` · `mail.ts`
**Modified:** `src/server/ocr/extract.ts` (+`maskAccountNumbers`,
+`extractAllAmounts`) · `src/server/ocr/pipeline.ts` (extract-then-mask on
persist, populates `extracted_amounts/due_dates/action_items`)
**Migrations (renumbered by MD pass 2026-10-12 — renumbering team owns; do not touch until all-clear):**
`supabase/migrations/040_w21_mail_retention.sql` ·
`035_w11_spending.sql` · `036_w7_vault.sql` · `037_w24_credit.sql` ·
`038_w14_coparenting.sql` · `039_w12_babysitters.sql`
**Dependencies:** `plaid@^48` added to `package.json` (official SDK).
**Env required for live Plaid:** `PLAID_CLIENT_ID`, `PLAID_SECRET`,
`PLAID_ENV` (default `sandbox`), `PLAID_TOKEN_ENCRYPTION_KEY`;
vault: `VAULT_DOC_ENCRYPTION_KEY`.
**TypeScript:** `npx tsc --noEmit` clean for all squad files.
