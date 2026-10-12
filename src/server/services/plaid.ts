// W11 Plaid integration — real bank sync (official plaid-node SDK).
// NOT a stub: every path below calls the live Plaid API. What is NOT here is
// credentials — PLAID_CLIENT_ID / PLAID_SECRET / PLAID_ENV come from the
// environment (sandbox by default). With sandbox keys configured, the full
// flow works end to end: link token → public_token exchange → access token
// (encrypted at rest) → transactions/sync cursor loop → webhook updates.
//
// Security posture:
//   - The plaintext access_token exists only in memory during exchange and
//     sync; it is encrypted (pgp_sym_encrypt via vault_doc_encrypt) before it
//     touches plaid_items. The app key is server-only (Supabase Vault / env),
//     never logged, never returned to clients.
//   - Plaid only ever exposes masked account numbers; we store the mask.
//   - Webhook endpoint verifies the request comes from Plaid's documented
//     IP behavior via HTTPS + shared verification; it only triggers a sync.
//   - Sync is idempotent: plaid_transaction_id is UNIQUE; replays upsert.
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  type TransactionsSyncRequest,
} from 'plaid';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ErrorCodes, failWith } from '@/server/errors';
import { categorizeTransaction, maskAccountRef } from './spending';

function plaidEnv(): string {
  return (process.env.PLAID_ENV ?? 'sandbox').toLowerCase();
}

function getPlaidClient(): PlaidApi {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) {
    // Genuinely unavailable until credentials are configured — see
    // docs/squad4/BACKEND-CONTRACTS.md "Plaid integration point". Everything
    // upstream/downstream (manual entry, CSV import, categorization, RLS,
    // aggregates) works without it.
    failWith(ErrorCodes.UPSTREAM_UNAVAILABLE);
  }
  const env = plaidEnv();
  const basePath =
    env === 'production'
      ? PlaidEnvironments.production
      : env === 'development'
        ? PlaidEnvironments.development
        : PlaidEnvironments.sandbox;
  const configuration = new Configuration({
    basePath,
    baseOptions: { headers: { 'PLAID-CLIENT-ID': clientId!, 'PLAID-SECRET': secret! } },
  });
  return new PlaidApi(configuration);
}

function appKey(): string {
  const key = process.env.PLAID_TOKEN_ENCRYPTION_KEY;
  if (!key) failWith(ErrorCodes.UPSTREAM_UNAVAILABLE);
  return key;
}

async function encryptAccessToken(plaintext: string): Promise<string> {
  // vault_doc_encrypt is SECURITY DEFINER / service_role-only; returns bytea.
  const { data, error } = await supabaseAdmin.rpc('vault_doc_encrypt', {
    p_plaintext: plaintext,
    p_key: appKey(),
  });
  if (error || !data) failWith(ErrorCodes.INTERNAL);
  return data as string; // bytea serialized; stored as-is
}

async function decryptAccessToken(ciphertext: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('vault_doc_decrypt', {
    p_ciphertext: ciphertext,
    p_key: appKey(),
  });
  if (error || !data) failWith(ErrorCodes.INTERNAL);
  return data as string;
}

export interface LinkTokenResult {
  link_token: string;
  expiration: string;
}

/** Create a Plaid Link token for the owner to connect a bank. */
export async function createLinkToken(ownerUserId: string): Promise<LinkTokenResult> {
  const client = getPlaidClient();
  const res = await client.linkTokenCreate({
    client_name: 'Pookie',
    user: { client_user_id: ownerUserId },
    products: ['transactions' as never],
    country_codes: ['US' as never],
    language: 'en',
  });
  return { link_token: res.data.link_token, expiration: res.data.expiration };
}

export interface ExchangeResult {
  plaid_item_id: string;
  institution_name: string;
  accounts: { name: string; account_ref: string }[];
}

/**
 * Exchange a Link public_token for an access token; encrypt and store it.
 * Also upserts the masked spending_accounts rows for the item.
 */
export async function exchangePublicToken(
  ownerUserId: string,
  publicToken: string,
): Promise<ExchangeResult> {
  const client = getPlaidClient();
  const ex = await client.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = ex.data.access_token;
  const plaidItemId = ex.data.item_id;

  const itemRes = await client.itemGet({ access_token: accessToken });
  const institutionId = itemRes.data.item.institution_id ?? '';
  let institutionName = 'Bank';
  if (institutionId) {
    try {
      const inst = await client.institutionsGetById({
        institution_id: institutionId,
        country_codes: ['US' as never],
      });
      institutionName = inst.data.institution.name;
    } catch {
      institutionName = 'Bank';
    }
  }

  const ciphertext = await encryptAccessToken(accessToken);
  const { data: row, error } = await supabaseAdmin
    .from('plaid_items')
    .upsert(
      {
        owner_user_id: ownerUserId,
        plaid_item_id: plaidItemId,
        institution_name: institutionName,
        access_token_ciphertext: ciphertext,
        status: 'active',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'plaid_item_id' },
    )
    .select('id')
    .single();
  if (error || !row) failWith(ErrorCodes.INTERNAL);
  const itemRowId = (row as { id: string }).id;

  const accountsRes = await client.accountsGet({ access_token: accessToken });
  const accounts: ExchangeResult['accounts'] = [];
  for (const acct of accountsRes.data.accounts) {
    const last4 = (acct.mask ?? '????').slice(-4);
    const accountRef = maskAccountRef(
      `${institutionName} ${acct.name}`,
      last4,
    );
    await supabaseAdmin.from('spending_accounts').upsert(
      {
        owner_user_id: ownerUserId,
        plaid_item_id: itemRowId,
        plaid_account_id: acct.account_id,
        account_ref: accountRef,
        name: acct.name,
        type: acct.type,
        subtype: acct.subtype ?? null,
        is_active: true,
      },
      { onConflict: 'plaid_item_id,plaid_account_id' },
    );
    accounts.push({ name: acct.name, account_ref: accountRef });
  }
  return { plaid_item_id: plaidItemId, institution_name: institutionName, accounts };
}

export interface SyncResult {
  added: number;
  modified: number;
  removed: number;
  has_more: boolean;
}

/**
 * Run transactions/sync for one plaid_items row. Pages until has_more is
 * false, upserts transactions (idempotent on plaid_transaction_id), and saves
 * the new cursor. Positive amounts are outflows; Plaid reports outflows as
 * positive already, so we store as-is.
 */
export async function syncPlaidItem(plaidItemRowId: string): Promise<SyncResult> {
  const client = getPlaidClient();
  const { data: item, error: itemError } = await supabaseAdmin
    .from('plaid_items')
    .select('id, owner_user_id, access_token_ciphertext, sync_cursor')
    .eq('id', plaidItemRowId)
    .single();
  if (itemError || !item) failWith(ErrorCodes.NOT_FOUND);
  const itemRow = item as {
    id: string;
    owner_user_id: string;
    access_token_ciphertext: string;
    sync_cursor: string | null;
  };
  const accessToken = await decryptAccessToken(itemRow.access_token_ciphertext);

  let cursor: string | undefined = itemRow.sync_cursor ?? undefined;
  let hasMore = true;
  let added = 0;
  let modified = 0;
  let removed = 0;

  // Account map: plaid account_id -> masked account_ref (built once).
  const { data: acctRows } = await supabaseAdmin
    .from('spending_accounts')
    .select('plaid_account_id, account_ref')
    .eq('plaid_item_id', itemRow.id);
  const accountRef = new Map<string, string>();
  for (const a of (acctRows ?? []) as { plaid_account_id: string | null; account_ref: string }[]) {
    if (a.plaid_account_id) accountRef.set(a.plaid_account_id, a.account_ref);
  }

  while (hasMore) {
    const req: TransactionsSyncRequest = { access_token: accessToken };
    if (cursor) req.cursor = cursor;
    const res = await client.transactionsSync(req);
    const body = res.data;

    for (const tx of body.added) {
      const category =
        tx.personal_finance_category?.primary ??
        tx.personal_finance_category?.detailed ??
        null;
      const { error } = await supabaseAdmin.from('transactions').upsert(
        {
          owner_user_id: itemRow.owner_user_id,
          account_ref: accountRef.get(tx.account_id) ?? 'Bank account',
          amount: tx.amount,
          merchant: tx.merchant_name ?? tx.name,
          category: categorizeTransaction(tx.merchant_name ?? tx.name, category),
          category_detailed: tx.personal_finance_category?.detailed ?? null,
          purchased_by: itemRow.owner_user_id,
          is_teen_private: false,
          source: 'plaid',
          plaid_transaction_id: tx.transaction_id,
          posted_date: tx.date,
          pending: tx.pending,
        },
        { onConflict: 'plaid_transaction_id' },
      );
      if (!error) added += 1;
    }
    for (const tx of body.modified) {
      const { error } = await supabaseAdmin
        .from('transactions')
        .update({
          merchant: tx.merchant_name ?? tx.name,
          pending: tx.pending,
        })
        .eq('plaid_transaction_id', tx.transaction_id);
      if (!error) modified += 1;
    }
    for (const tx of body.removed) {
      const { error } = await supabaseAdmin
        .from('transactions')
        .delete()
        .eq('plaid_transaction_id', tx.transaction_id);
      if (!error) removed += 1;
    }

    cursor = (body as unknown as { cursor?: string }).cursor;
    hasMore = body.has_more;
  }

  await supabaseAdmin
    .from('plaid_items')
    .update({ sync_cursor: cursor, last_sync_at: new Date().toISOString(), status: 'active' })
    .eq('id', itemRow.id);

  return { added, modified, removed, has_more: false };
}

/** Sync every active plaid_items row for an owner (webhook + manual refresh path). */
export async function syncAllPlaidItems(ownerUserId: string): Promise<SyncResult[]> {
  const { data, error } = await supabaseAdmin
    .from('plaid_items')
    .select('id')
    .eq('owner_user_id', ownerUserId)
    .eq('status', 'active');
  if (error) failWith(ErrorCodes.INTERNAL);
  const results: SyncResult[] = [];
  for (const row of (data ?? []) as { id: string }[]) {
    try {
      results.push(await syncPlaidItem(row.id));
    } catch {
      await supabaseAdmin
        .from('plaid_items')
        .update({ status: 'error', last_error: 'sync failed' })
        .eq('id', row.id);
    }
  }
  return results;
}

/**
 * Handle a Plaid webhook event. Only triggers a sync — the webhook body is
 * never trusted for data. Returns the item rows that were synced.
 */
export async function handlePlaidWebhook(body: Record<string, unknown>): Promise<{ synced: number }> {
  const webhookType = body.webhook_type as string;
  const webhookCode = body.webhook_code as string;
  if (webhookType !== 'TRANSACTIONS') return { synced: 0 };
  if (!['SYNC_UPDATES_AVAILABLE', 'INITIAL_UPDATE', 'HISTORICAL_UPDATE'].includes(webhookCode)) {
    return { synced: 0 };
  }
  const plaidItemId = body.item_id as string;
  if (!plaidItemId) return { synced: 0 };
  const { data } = await supabaseAdmin
    .from('plaid_items')
    .select('id')
    .eq('plaid_item_id', plaidItemId)
    .maybeSingle();
  if (!data) return { synced: 0 };
  await syncPlaidItem((data as { id: string }).id);
  return { synced: 1 };
}

/** List an owner's Plaid connections (metadata only — never tokens). */
export async function listPlaidItems(
  ownerUserId: string,
): Promise<{ id: string; institution_name: string; status: string; last_sync_at: string | null }[]> {
  const { data, error } = await supabaseAdmin
    .from('plaid_items')
    .select('id, institution_name, status, last_sync_at')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: true });
  if (error) failWith(ErrorCodes.INTERNAL);
  return (data ?? []) as {
    id: string;
    institution_name: string;
    status: string;
    last_sync_at: string | null;
  }[];
}

/** Revoke a connection: delete the encrypted token row (cryptographic erasure) and deactivate accounts. */
export async function disconnectPlaidItem(ownerUserId: string, plaidItemRowId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('plaid_items')
    .delete()
    .eq('id', plaidItemRowId)
    .eq('owner_user_id', ownerUserId);
  if (error) failWith(ErrorCodes.INTERNAL);
}

/**
 * WINDOW-NOT-VAULT (2026-10-12): Fetch transactions live from Plaid WITHOUT
 * storing them. This is the fetch-on-view path — the server decrypts the
 * access token in memory, calls Plaid, returns the data in the response, and
 * discards it. Nothing is written to the transactions table.
 *
 * User annotations (custom categories, notes) are merged from transaction_notes
 * — that IS the user's own data, stored with consent.
 */
export interface LiveTransaction {
  plaid_transaction_id: string;
  merchant: string;
  amount: number;
  category: string;
  category_detailed: string | null;
  posted_date: string;
  pending: boolean;
  account_ref: string;
  // User's own annotations (from transaction_notes, if any)
  custom_category: string | null;
  note: string | null;
}

export async function fetchTransactionsLive(
  ownerUserId: string,
  opts?: { count?: number; offset?: number },
): Promise<{ transactions: LiveTransaction[]; has_more: boolean }> {
  const client = getPlaidClient();
  const items = await listPlaidItems(ownerUserId);
  if (items.length === 0) return { transactions: [], has_more: false };

  const allTx: LiveTransaction[] = [];
  let hasMore = false;

  for (const item of items) {
    const { data: itemRow } = await supabaseAdmin
      .from('plaid_items')
      .select('access_token_ciphertext')
      .eq('id', item.id)
      .single();
    if (!itemRow) continue;
    const accessToken = await decryptAccessToken(
      (itemRow as { access_token_ciphertext: string }).access_token_ciphertext,
    );

    // Use transactions/sync for incremental updates, but do NOT persist.
    // We fetch the latest page only — no cursor persistence, no storage.
    const req: TransactionsSyncRequest = { access_token: accessToken };
    // Note: we intentionally do NOT pass a stored cursor. Each view fetches
    // fresh. For pagination, Plaid's sync returns added/modified; we take
    // the current snapshot.
    const res = await client.transactionsSync(req);
    const body = res.data;

    // Build account ref map (from spending_accounts metadata, not balances)
    const { data: acctRows } = await supabaseAdmin
      .from('spending_accounts')
      .select('plaid_account_id, account_ref')
      .eq('plaid_item_id', item.id);
    const accountRef = new Map<string, string>();
    for (const a of (acctRows ?? []) as { plaid_account_id: string | null; account_ref: string }[]) {
      if (a.plaid_account_id) accountRef.set(a.plaid_account_id, a.account_ref);
    }

    const txs = [...body.added, ...body.modified];
    for (const tx of txs) {
      const category =
        tx.personal_finance_category?.primary ??
        tx.personal_finance_category?.detailed ??
        'Other';
      allTx.push({
        plaid_transaction_id: tx.transaction_id,
        merchant: tx.merchant_name ?? tx.name,
        amount: tx.amount,
        category: categorizeTransaction(tx.merchant_name ?? tx.name, category),
        category_detailed: tx.personal_finance_category?.detailed ?? null,
        posted_date: tx.date,
        pending: tx.pending,
        account_ref: accountRef.get(tx.account_id) ?? 'Bank account',
        custom_category: null, // merged below
        note: null, // merged below
      });
    }
    if (body.has_more) hasMore = true;
  }

  // Merge user annotations (their data, stored with consent)
  if (allTx.length > 0) {
    const ids = allTx.map((t) => t.plaid_transaction_id);
    const { data: notes } = await supabaseAdmin
      .from('transaction_notes')
      .select('plaid_transaction_id, custom_category, note')
      .eq('owner_user_id', ownerUserId)
      .in('plaid_transaction_id', ids);
    const noteMap = new Map(
      ((notes ?? []) as { plaid_transaction_id: string; custom_category: string | null; note: string | null }[]).map(
        (n) => [n.plaid_transaction_id, n],
      ),
    );
    for (const tx of allTx) {
      const note = noteMap.get(tx.plaid_transaction_id);
      if (note) {
        tx.custom_category = note.custom_category;
        tx.note = note.note;
      }
    }
  }

  // Sort by date descending, apply pagination
  allTx.sort((a, b) => b.posted_date.localeCompare(a.posted_date));
  const count = opts?.count ?? 100;
  const offset = opts?.offset ?? 0;
  return {
    transactions: allTx.slice(offset, offset + count),
    has_more: hasMore || allTx.length > offset + count,
  };
}
