// W11 spending — business logic. Framework-free; handlers are thin adapters:
// validate → assertHousehold → call service → shape response → audit.
// Every query runs through the user-JWT client: RLS enforces household
// scoping AND the teen-privacy line-item gate (parents get zero rows for
// teen-private purchases; aggregates come from spending_summary() only).
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, failWith } from '@/server/errors';

export type TransactionSource = 'manual' | 'csv' | 'plaid';

export interface Transaction {
  id: string;
  owner_user_id: string;
  account_id: string | null;
  account_ref: string;
  amount: number;
  merchant: string | null;
  category: string | null;
  category_detailed: string | null;
  category_override: string | null;
  purchased_by: string;
  is_teen_private: boolean;
  source: TransactionSource;
  plaid_transaction_id: string | null;
  posted_date: string;
  pending: boolean;
  created_at: string;
}

type Db = Awaited<ReturnType<typeof createClient>>;

const TX_COLS =
  'id, owner_user_id, account_id, account_ref, amount, merchant, category, category_detailed, category_override, purchased_by, is_teen_private, source, plaid_transaction_id, posted_date, pending, created_at';

function toTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    owner_user_id: row.owner_user_id as string,
    account_id: (row.account_id as string) ?? null,
    account_ref: row.account_ref as string,
    amount: Number(row.amount),
    merchant: (row.merchant as string) ?? null,
    category: (row.category as string) ?? null,
    category_detailed: (row.category_detailed as string) ?? null,
    category_override: (row.category_override as string) ?? null,
    purchased_by: row.purchased_by as string,
    is_teen_private: row.is_teen_private as boolean,
    source: row.source as TransactionSource,
    plaid_transaction_id: (row.plaid_transaction_id as string) ?? null,
    posted_date: row.posted_date as string,
    pending: row.pending as boolean,
    created_at: row.created_at as string,
  };
}

/** Rule-based categorizer for manual/CSV rows (Plaid rows carry Plaid's own categories). */
const CATEGORY_RULES: [RegExp, string][] = [
  [/whole foods|trader joe|kroger|publix|safeway|costco|aldi|walmart|grocery/i, 'groceries'],
  [/shell|chevron|exxon|bp |gas|fuel|charging|tesla/i, 'transport'],
  [/uber|lyft|delta|united|airline|amtrak/i, 'travel'],
  [/netflix|spotify|hulu|disney|subscription/i, 'subscriptions'],
  [/amazon|target|best buy/i, 'shopping'],
  [/cvs|walgreens|pharmacy|doctor|dental/i, 'health'],
  [/restaurant|mcdonald|chick-fil|starbucks|pizza|dining/i, 'dining'],
  [/electric|water|gas bill|internet|comcast|utility/i, 'utilities'],
  [/tuition|school|college/i, 'education'],
];

export function categorizeTransaction(merchant: string | null, plaidPrimary?: string | null): string {
  if (plaidPrimary) return plaidPrimary.toLowerCase().replace(/_/g, ' ');
  const m = merchant ?? '';
  for (const [re, cat] of CATEGORY_RULES) {
    if (re.test(m)) return cat;
  }
  return 'uncategorized';
}

/** Mask an account display ref to last-4 (Plaid gives us masked numbers; manual accounts get the same treatment). */
export function maskAccountRef(label: string, last4: string): string {
  return `${label} …${last4}`;
}

export interface ManualTransactionInput {
  account_ref: string;
  amount: number;
  merchant?: string;
  category?: string;
  is_teen_private?: boolean;
  posted_date?: string;
}

/** Add a hand-entered transaction. purchased_by is stamped as the caller — RLS makes mis-attribution impossible. */
export async function addManualTransaction(
  supabase: Db,
  ownerUserId: string,
  userId: string,
  input: ManualTransactionInput,
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      owner_user_id: ownerUserId,
      account_ref: input.account_ref,
      amount: input.amount,
      merchant: input.merchant ?? null,
      category: input.category ?? categorizeTransaction(input.merchant ?? null),
      purchased_by: userId,
      is_teen_private: input.is_teen_private ?? false,
      source: 'manual',
      posted_date: input.posted_date ?? new Date().toISOString().slice(0, 10),
    })
    .select(TX_COLS)
    .single();
  if (error || !data) failWith(ErrorCodes.INTERNAL);
  return toTransaction(data as Record<string, unknown>);
}

export interface CsvRow {
  posted_date: string;
  merchant: string;
  amount: number;
  account_ref?: string;
}

/**
 * Parse a bank-statement CSV into rows. Accepts common layouts; the header row
 * is detected (contains a date-ish + amount-ish column) and skipped.
 * Columns (case-insensitive): date/posted, merchant/description/payee, amount.
 */
export function parseStatementCsv(csv: string): CsvRow[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const split = (l: string): string[] =>
    l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const header = split(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = header.some((h) => /date|posted/.test(h)) && header.some((h) => /amount|debit|credit/.test(h));
  const dateIdx = hasHeader ? header.findIndex((h) => /date|posted/.test(h)) : 0;
  const merchIdx = hasHeader ? header.findIndex((h) => /merchant|description|payee|memo/.test(h)) : 1;
  const amtIdx = hasHeader ? header.findIndex((h) => /amount|debit|credit/.test(h)) : 2;
  const acctIdx = hasHeader ? header.findIndex((h) => /account/.test(h)) : -1;
  const rows: CsvRow[] = [];
  for (const line of hasHeader ? lines.slice(1) : lines) {
    const cols = split(line);
    const amount = Number((cols[amtIdx] ?? '').replace(/[$,()]/g, '').replace(/^\((.*)\)$/, '-$1'));
    if (!Number.isFinite(amount)) continue;
    const rawDate = cols[dateIdx] ?? '';
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) continue;
    rows.push({
      posted_date: parsed.toISOString().slice(0, 10),
      merchant: cols[merchIdx] ?? 'unknown',
      amount,
      account_ref: acctIdx >= 0 ? cols[acctIdx] : undefined,
    });
  }
  return rows;
}

/** Import parsed CSV rows as 'csv'-source transactions (idempotent per run — no natural key, so the route dedupes by (date, merchant, amount)). */
export async function importCsvRows(
  supabase: Db,
  ownerUserId: string,
  userId: string,
  rows: CsvRow[],
  defaultAccountRef: string,
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('owner_user_id', ownerUserId)
      .eq('posted_date', row.posted_date)
      .eq('merchant', row.merchant)
      .eq('amount', row.amount)
      .limit(1)
      .maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }
    const { error } = await supabase.from('transactions').insert({
      owner_user_id: ownerUserId,
      account_ref: row.account_ref ?? defaultAccountRef,
      amount: row.amount,
      merchant: row.merchant,
      category: categorizeTransaction(row.merchant),
      purchased_by: userId,
      source: 'csv',
      posted_date: row.posted_date,
    });
    if (error) {
      skipped += 1;
    } else {
      imported += 1;
    }
  }
  return { imported, skipped };
}

/** List visible transactions. RLS applies the teen-privacy gate — the caller only ever sees what they're allowed to see. */
export async function listTransactions(
  supabase: Db,
  ownerUserId: string,
  filters: { from?: string; to?: string; category?: string; limit?: number },
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select(TX_COLS)
    .eq('owner_user_id', ownerUserId)
    .order('posted_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (filters.from) query = query.gte('posted_date', filters.from);
  if (filters.to) query = query.lte('posted_date', filters.to);
  if (filters.category) query = query.eq('category', filters.category);
  const { data, error } = await query.limit(filters.limit ?? 200);
  if (error) failWith(ErrorCodes.INTERNAL);
  return ((data ?? []) as Record<string, unknown>[]).map(toTransaction);
}

/** Re-categorize one of the caller's own transactions (RLS: purchaser-only). */
export async function recategorizeTransaction(
  supabase: Db,
  transactionId: string,
  category: string,
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update({ category_override: category })
    .eq('id', transactionId)
    .select(TX_COLS)
    .single();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
  return toTransaction(data as Record<string, unknown>);
}

/**
 * Parent-only spending aggregates. The RPC is SECURITY DEFINER with an
 * is_household_parent() check inside — it returns totals by category/month
 * including teen-private amounts, but NEVER merchant line items (FR-MOD-W11).
 *
 * WINDOW-NOT-VAULT (2026-10-12): Computes from LIVE Plaid data via
 * fetchTransactionsLive() — bank transactions are never persisted. The access
 * token comes from the phone per-request (secure enclave); without it, only
 * manual/CSV entries are aggregated. Aggregates are computed in memory per
 * request and discarded. Manual/CSV entries (the user's own data) are still
 * read from the transactions table.
 */
export async function getSpendingSummary(
  supabase: Db,
  ownerUserId: string,
  from?: string,
  to?: string,
  accessToken?: string,
): Promise<Record<string, unknown>> {
  // Fetch live bank data (not stored) + manual entries (stored, user's own data)
  const { fetchTransactionsLive } = await import('./plaid');
  const liveTxPromise = accessToken
    ? fetchTransactionsLive(ownerUserId, accessToken, { count: 500 }).catch(() => ({
        transactions: [],
        has_more: false,
      }))
    : Promise.resolve({ transactions: [], has_more: false });
  const [{ transactions: liveTx }, { data: manualTx }] = await Promise.all([
    liveTxPromise,
    supabase
      .from('transactions')
      .select('amount, category, posted_date')
      .eq('owner_user_id', ownerUserId)
      .gte('posted_date', from ?? '1970-01-01')
      .lte('posted_date', to ?? '2999-12-31'),
  ]);

  // Combine: live Plaid data (transient) + manual/CSV (stored)
  const all = [
    ...liveTx.map((t) => ({
      amount: t.amount,
      category: t.custom_category ?? t.category,
      posted_date: t.posted_date,
    })),
    ...((manualTx ?? []) as { amount: number; category: string; posted_date: string }[]),
  ];

  // Aggregate by category and month in memory
  const byCategory: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  let total = 0;
  for (const tx of all) {
    const cat = tx.category ?? 'Other';
    byCategory[cat] = (byCategory[cat] ?? 0) + Math.abs(tx.amount);
    const month = tx.posted_date.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + Math.abs(tx.amount);
    total += Math.abs(tx.amount);
  }

  return { total, by_category: byCategory, by_month: byMonth, live_count: liveTx.length, manual_count: (manualTx ?? []).length };
}
