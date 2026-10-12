// W11 Plaid integration — real bank data via the official plaid-node SDK.
//
// WINDOW-NOT-VAULT (2026-10-12): The Plaid access token lives on the user's
// phone (OS secure enclave), NEVER on our servers. The backend is a blind
// proxy: the phone sends the token per-request, we attach the Plaid
// client_id/secret (server-only, never exposed to clients), call Plaid, return
// the data, and discard the token from memory. Nothing is persisted.
//
// Flow: link token → public_token exchange (token returned to phone, metadata
// stored) → fetch-on-view per request → disconnect revokes at Plaid.
//
// Security posture:
//   - access_token: phone-held (Keychain/Keystore). Server sees it transiently
//     per request (must, to attach the secret). Never logged, never persisted.
//     A database breach yields zero bank access.
//   - PLAID_CLIENT_ID / PLAID_SECRET: server-only env vars, never in responses.
//   - Plaid only ever exposes masked account numbers; we store the mask.
//   - Webhooks retired (non-functional without stored tokens).
//   - Bank usernames/passwords never touch our servers (Plaid Link handles auth).
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

/**
 * Exchange a Link public_token for an access token; encrypt and store it.
 * Also upserts the masked spending_accounts rows for the item.
 */
export interface ExchangeResult {
  plaid_item_id: string;
  institution_name: string;
  accounts: { name: string; account_ref: string }[];
  /**
   * WINDOW-NOT-VAULT (2026-10-12): The access token is returned to the phone,
   * which stores it in the OS secure enclave (iOS Keychain / Android Keystore).
   * The server NEVER persists it — it exists in server memory only during this
   * exchange call, then is discarded. The phone sends it back per-request for
   * live fetches (blind-proxy pattern).
   */
  access_token: string;
}

/**
 * Exchange a Plaid Link public_token. The access token is returned to the
 * caller (the phone) for secure-enclave storage — it is NEVER written to the
 * database. Only connection metadata (institution, masked accounts) is stored.
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

  // Metadata only — NO access token stored. The token goes back to the phone.
  const { data: row, error } = await supabaseAdmin
    .from('plaid_items')
    .upsert(
      {
        owner_user_id: ownerUserId,
        plaid_item_id: plaidItemId,
        institution_name: institutionName,
        access_token_ciphertext: null,
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
  // accessToken is returned to the phone here and discarded from server memory
  // after this function returns. It is never logged, never persisted.
  return { plaid_item_id: plaidItemId, institution_name: institutionName, accounts, access_token: accessToken };
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

/**
 * Revoke a connection. The phone provides the access token one final time;
 * we call Plaid /item/remove to kill it at the source, then delete our
 * metadata row. Since we never stored the token, there is nothing to
 * cryptographically erase server-side — the token dies at Plaid and the
 * phone deletes its Keychain entry.
 */
export async function disconnectPlaidItem(
  ownerUserId: string,
  plaidItemRowId: string,
  accessToken: string,
): Promise<void> {
  const client = getPlaidClient();
  try {
    await client.itemRemove({ access_token: accessToken });
  } catch {
    // Token may already be revoked — proceed to clean up metadata anyway.
  }
  const { error } = await supabaseAdmin
    .from('plaid_items')
    .delete()
    .eq('id', plaidItemRowId)
    .eq('owner_user_id', ownerUserId);
  if (error) failWith(ErrorCodes.INTERNAL);
}

/**
 * WINDOW-NOT-VAULT (2026-10-12): Fetch transactions live from Plaid WITHOUT
 * storing them. The access token comes from the phone per-request (it lives
 * in the OS secure enclave, never on our servers). This is the fetch-on-view
 * path — the server uses the token in memory, calls Plaid, returns the data
 * in the response, and discards it. Nothing is written to the transactions table.
 *
 * The backend is a blind proxy: it attaches the Plaid client_id/secret (which
 * cannot live on the phone) and forwards. The token is never logged, never
 * persisted — it exists in server memory only for the duration of this call.
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
  accessToken: string,
  opts?: { count?: number; offset?: number },
): Promise<{ transactions: LiveTransaction[]; has_more: boolean }> {
  const client = getPlaidClient();

  const allTx: LiveTransaction[] = [];
  let hasMore = false;

  // Use transactions/sync for the latest data, but do NOT persist.
  // Each view fetches fresh — no cursor persistence, no storage.
  const req: TransactionsSyncRequest = { access_token: accessToken };
  const res = await client.transactionsSync(req);
  const body = res.data;

  // Build account ref map from spending_accounts metadata (not balances)
  const { data: items } = await supabaseAdmin
    .from('plaid_items')
    .select('id')
    .eq('owner_user_id', ownerUserId);
  const itemIds = ((items ?? []) as { id: string }[]).map((i) => i.id);
  const accountRef = new Map<string, string>();
  if (itemIds.length > 0) {
    const { data: acctRows } = await supabaseAdmin
      .from('spending_accounts')
      .select('plaid_account_id, account_ref')
      .in('plaid_item_id', itemIds);
    for (const a of (acctRows ?? []) as { plaid_account_id: string | null; account_ref: string }[]) {
      if (a.plaid_account_id) accountRef.set(a.plaid_account_id, a.account_ref);
    }
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
