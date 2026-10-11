// W20 shopping list business logic — framework-free. Handlers (route.ts) are
// thin adapters: validate → assertHousehold → call service → shape response →
// audit. Every query runs through the user-JWT client (RLS enforces
// household scoping); no service_role here, ever.
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, failWith } from '@/server/errors';

export type ItemStatus = 'needed' | 'claimed' | 'bought' | 'removed';
export type ItemSource = 'manual' | 'meal-plan' | 'recurring' | 'ai-suggestion';

export interface ShoppingList {
  id: string;
  owner_user_id: string;
  name: string;
  preferences: Record<string, unknown>;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  list_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  status: ItemStatus;
  added_by: string | null;
  added_by_name: string | null;
  claimed_by: string | null;
  bought_by: string | null;
  bought_at: string | null;
  store: string | null;
  price_paid: number | null;
  source: ItemSource;
  source_ref: Record<string, unknown> | null;
  created_at: string;
}

export interface PriceReport {
  id: string;
  list_id: string;
  item_name: string;
  store: string;
  price: number;
  reported_by: string | null;
  reported_by_name: string | null;
  reported_at: string;
  receipt_item_id: string | null;
  created_at: string;
}

/** Normalized names are the dedupe key (spec §2.2). */
export function normalizeName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Forward-only state machine + the two sanctioned exceptions. */
const ALLOWED_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  needed: ['claimed', 'removed'],
  claimed: ['needed', 'bought', 'removed'], // claimed → needed is the sanctioned unclaim
  bought: ['removed'],
  removed: [], // terminal
};

export function assertTransitionAllowed(from: ItemStatus, to: ItemStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) failWith(ErrorCodes.CONFLICT);
}

type Db = Awaited<ReturnType<typeof createClient>>;

function toShoppingItem(row: Record<string, unknown>): ShoppingItem {
  return {
    id: row.id as string,
    list_id: row.list_id as string,
    name: row.name as string,
    quantity: row.quantity == null ? null : Number(row.quantity),
    unit: (row.unit as string) ?? null,
    note: (row.note as string) ?? null,
    status: row.status as ItemStatus,
    added_by: (row.added_by as string) ?? null,
    added_by_name: null, // filled by withNames()
    claimed_by: (row.claimed_by as string) ?? null,
    bought_by: (row.bought_by as string) ?? null,
    bought_at: (row.bought_at as string) ?? null,
    store: (row.store as string) ?? null,
    price_paid: row.price_paid == null ? null : Number(row.price_paid),
    source: row.source as ItemSource,
    source_ref: (row.source_ref as Record<string, unknown>) ?? null,
    created_at: row.created_at as string,
  };
}

function toPriceReport(row: Record<string, unknown>): PriceReport {
  return {
    id: row.id as string,
    list_id: row.list_id as string,
    item_name: row.item_name as string,
    store: row.store as string,
    price: Number(row.price),
    reported_by: (row.reported_by as string) ?? null,
    reported_by_name: null, // filled by withNames()
    reported_at: row.reported_at as string,
    receipt_item_id: (row.receipt_item_id as string) ?? null,
    created_at: row.created_at as string,
  };
}

/**
 * Resolve display names for user ids. RLS on users (self_read) scopes this to
 * what the caller may see: parents resolve co-member names; child-role callers
 * see only their own row — other items' tags fall back to "Family" in the UI.
 * (A DBA-owned household_member_names() definer RPC would close this gap for
 * child-role callers; it is not in migration 007.)
 */
export async function resolveDisplayNames(
  supabase: Db,
  userIds: (string | null)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from('users')
    .select('id, display_name')
    .in('id', ids);
  for (const row of (data ?? []) as { id: string; display_name: string | null }[]) {
    map.set(row.id, row.display_name ?? 'Family');
  }
  return map;
}

/** Ensure the owner's list row exists (parent callers only — INSERT is owner-only in RLS). */
export async function ensureHouseholdList(
  supabase: Db,
  ownerUserId: string,
): Promise<ShoppingList> {
  const { error: upsertError } = await supabase
    .from('shopping_lists')
    .upsert({ owner_user_id: ownerUserId }, { onConflict: 'owner_user_id' });
  if (upsertError) failWith(ErrorCodes.INTERNAL);
  return getHouseholdList(supabase, ownerUserId);
}

export async function getHouseholdList(
  supabase: Db,
  ownerUserId: string,
): Promise<ShoppingList> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('id, owner_user_id, name, preferences, created_at')
    .eq('owner_user_id', ownerUserId)
    .single();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
  const row = data as {
    id: string;
    owner_user_id: string;
    name: string;
    preferences: unknown;
    created_at: string;
  };
  return {
    id: row.id,
    owner_user_id: row.owner_user_id,
    name: row.name,
    preferences: (row.preferences ?? {}) as Record<string, unknown>,
    created_at: row.created_at,
  };
}

const STATUS_ORDER: ItemStatus[] = ['needed', 'claimed', 'bought'];

/** Visible items: status != 'removed', open first, then oldest first. */
/** Resolve the caller's household list. Parent callers auto-create the list row
 *  on first visit (INSERT is owner-only per RLS); child-role callers read the
 *  existing row (NOT_FOUND until a parent has visited). */
export async function resolveHouseholdList(
  supabase: Db,
  ctx: { ownerUserId: string; role: 'parent' | 'child' },
): Promise<ShoppingList> {
  if (ctx.role === 'parent') return ensureHouseholdList(supabase, ctx.ownerUserId);
  return getHouseholdList(supabase, ctx.ownerUserId);
}

/** Visible items: status != 'removed', open first, then oldest first. */
export async function getVisibleItems(
  supabase: Db,
  listId: string,
): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select(
      'id, list_id, name, quantity, unit, note, status, added_by, claimed_by, bought_by, bought_at, store, price_paid, source, source_ref, created_at',
    )
    .eq('list_id', listId)
    .neq('status', 'removed')
    .order('created_at', { ascending: true });
  if (error) failWith(ErrorCodes.INTERNAL);
  const rows = ((data ?? []) as Record<string, unknown>[]).map(toShoppingItem);
  const names = await resolveDisplayNames(
    supabase,
    rows.map((r) => r.added_by),
  );
  for (const row of rows) {
    row.added_by_name = row.added_by ? (names.get(row.added_by) ?? null) : null;
  }
  rows.sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );
  return rows;
}

/** Fetch one item, scoped to the caller's household list (404 otherwise). */
export async function getHouseholdItem(
  supabase: Db,
  listId: string,
  itemId: string,
): Promise<ShoppingItem> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select(
      'id, list_id, name, quantity, unit, note, status, added_by, claimed_by, bought_by, bought_at, store, price_paid, source, source_ref, created_at',
    )
    .eq('id', itemId)
    .eq('list_id', listId)
    .neq('status', 'removed')
    .single();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
  return toShoppingItem(data as Record<string, unknown>);
}

export interface AddItemInput {
  name: string;
  quantity?: number;
  unit?: string;
  note?: string;
  source?: ItemSource;
  source_ref?: Record<string, unknown>;
}

/**
 * Add an item. Dedupe per spec §2.2: a needed/claimed row with the same
 * normalized name merges quantities and the existing row is returned
 * (merged: true). AI dedupe ("whole milk gallon" ≈ "milk") is a suggestion
 * flow — never a silent merge — and is not implemented here.
 */
export async function addItem(
  supabase: Db,
  listId: string,
  userId: string,
  input: AddItemInput,
): Promise<{ item: ShoppingItem; merged: boolean }> {
  const name = normalizeName(input.name);
  if (!name) failWith(ErrorCodes.VALIDATION_FAILED);

  const { data: existing } = await supabase
    .from('shopping_items')
    .select(
      'id, list_id, name, quantity, unit, note, status, added_by, claimed_by, bought_by, bought_at, store, price_paid, source, source_ref, created_at',
    )
    .eq('list_id', listId)
    .eq('name', name)
    .in('status', ['needed', 'claimed'])
    .limit(1)
    .maybeSingle();

  if (existing) {
    const row = toShoppingItem(existing as Record<string, unknown>);
    const newQty = Number(row.quantity ?? 1) + (input.quantity ?? 1);
    const { data: merged, error } = await supabase
      .from('shopping_items')
      .update({ quantity: newQty })
      .eq('id', row.id)
      .select(
        'id, list_id, name, quantity, unit, note, status, added_by, claimed_by, bought_by, bought_at, store, price_paid, source, source_ref, created_at',
      )
      .single();
    if (error || !merged) failWith(ErrorCodes.INTERNAL);
    return { item: toShoppingItem(merged as Record<string, unknown>), merged: true };
  }

  const { data, error } = await supabase
    .from('shopping_items')
    .insert({
      list_id: listId,
      name,
      quantity: input.quantity ?? 1,
      unit: input.unit ?? null,
      note: input.note ?? null,
      added_by: userId, // RLS enforces added_by = auth.uid(); service_role bypasses for workers
      source: input.source ?? 'manual',
      source_ref: (input.source_ref ?? null) as never,
    })
    .select(
      'id, list_id, name, quantity, unit, note, status, added_by, claimed_by, bought_by, bought_at, store, price_paid, source, source_ref, created_at',
    )
    .single();
  if (error || !data) failWith(ErrorCodes.INTERNAL);
  return { item: toShoppingItem(data as Record<string, unknown>), merged: false };
}

/** Batch add (W13 seam): meal plans drop grocery lists here, tagged. */
export async function addItemsBatch(
  supabase: Db,
  listId: string,
  userId: string,
  items: AddItemInput[],
  source: Exclude<ItemSource, 'manual'>,
  sourceRef?: Record<string, unknown>,
): Promise<{ items: ShoppingItem[]; merged: number }> {
  const results: ShoppingItem[] = [];
  let merged = 0;
  for (const input of items) {
    const { item, merged: wasMerged } = await addItem(supabase, listId, userId, {
      ...input,
      source,
      source_ref: sourceRef,
    });
    if (wasMerged) merged += 1;
    results.push(item);
  }
  return { items: results, merged };
}

export interface TransitionInput {
  status: 'needed' | 'claimed' | 'bought';
  store?: string;
  price_paid?: number;
}

/**
 * State transition with route-level stamping. A bought transition carrying
 * price_paid (+ store) also learns a shopping_price_reports row (receipt
 * learning) — sequential, not in a single transaction; the price insert is
 * best-effort and failures are logged server-side without failing the buy.
 */
export async function transitionItem(
  supabase: Db,
  listId: string,
  itemId: string,
  userId: string,
  input: TransitionInput,
): Promise<ShoppingItem> {
  const item = await getHouseholdItem(supabase, listId, itemId);
  assertTransitionAllowed(item.status, input.status);

  const patch: Record<string, unknown> = { status: input.status };
  if (input.status === 'claimed') {
    patch.claimed_by = userId;
  } else if (input.status === 'bought') {
    patch.bought_by = userId;
    patch.bought_at = new Date().toISOString();
    if (input.store) patch.store = input.store;
    if (input.price_paid != null) patch.price_paid = input.price_paid;
  } else if (input.status === 'needed') {
    // unclaim: clear the claim stamp
    patch.claimed_by = null;
  }

  const { data, error } = await supabase
    .from('shopping_items')
    .update(patch)
    .eq('id', itemId)
    .select(
      'id, list_id, name, quantity, unit, note, status, added_by, claimed_by, bought_by, bought_at, store, price_paid, source, source_ref, created_at',
    )
    .single();
  if (error || !data) failWith(ErrorCodes.INTERNAL);
  const updated = toShoppingItem(data as Record<string, unknown>);

  if (input.status === 'bought' && input.price_paid != null && input.store) {
    const { error: priceError } = await supabase
      .from('shopping_price_reports')
      .insert({
        list_id: listId,
        item_name: updated.name,
        store: input.store,
        price: input.price_paid,
        reported_by: userId,
        receipt_item_id: updated.id,
      });
    if (priceError) console.error('[shopping] receipt price learning failed:', priceError.message);
  }
  return updated;
}

/** Ledger-like soft remove (status='removed'); terminal. */
export async function removeItem(
  supabase: Db,
  listId: string,
  itemId: string,
): Promise<ShoppingItem> {
  const item = await getHouseholdItem(supabase, listId, itemId);
  assertTransitionAllowed(item.status, 'removed');
  const { data, error } = await supabase
    .from('shopping_items')
    .update({ status: 'removed' })
    .eq('id', itemId)
    .select(
      'id, list_id, name, quantity, unit, note, status, added_by, claimed_by, bought_by, bought_at, store, price_paid, source, source_ref, created_at',
    )
    .single();
  if (error || !data) failWith(ErrorCodes.INTERNAL);
  return toShoppingItem(data as Record<string, unknown>);
}

export async function getPriceReports(
  supabase: Db,
  listId: string,
  filters: { item?: string; store?: string },
): Promise<PriceReport[]> {
  let query = supabase
    .from('shopping_price_reports')
    .select(
      'id, list_id, item_name, store, price, reported_by, reported_at, receipt_item_id, created_at',
    )
    .eq('list_id', listId)
    .order('reported_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (filters.item) query = query.eq('item_name', normalizeName(filters.item));
  if (filters.store) query = query.eq('store', filters.store);
  const { data, error } = await query.limit(200);
  if (error) failWith(ErrorCodes.INTERNAL);
  const rows = ((data ?? []) as Record<string, unknown>[]).map(toPriceReport);
  const names = await resolveDisplayNames(
    supabase,
    rows.map((r) => r.reported_by),
  );
  for (const row of rows) {
    row.reported_by_name = row.reported_by ? (names.get(row.reported_by) ?? null) : null;
  }
  return rows;
}

export interface ReportPriceInput {
  item_name: string;
  store: string;
  price: number;
  reported_at?: string;
}

/** Append-only price memory (no UPDATE/DELETE by design). */
export async function reportPrice(
  supabase: Db,
  listId: string,
  userId: string,
  input: ReportPriceInput,
): Promise<PriceReport> {
  const { data, error } = await supabase
    .from('shopping_price_reports')
    .insert({
      list_id: listId,
      item_name: normalizeName(input.item_name),
      store: input.store,
      price: input.price,
      reported_by: userId,
      reported_at: input.reported_at ?? null,
    })
    .select(
      'id, list_id, item_name, store, price, reported_by, reported_at, receipt_item_id, created_at',
    )
    .single();
  if (error || !data) failWith(ErrorCodes.INTERNAL);
  return toPriceReport(data as Record<string, unknown>);
}

/** Merge preferences server-side (never replace). */
export async function updatePreferences(
  supabase: Db,
  listId: string,
  prefs: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data: current, error: readError } = await supabase
    .from('shopping_lists')
    .select('preferences')
    .eq('id', listId)
    .single();
  if (readError || !current) failWith(ErrorCodes.NOT_FOUND);
  const merged = {
    ...(((current as { preferences: unknown }).preferences ?? {}) as Record<string, unknown>),
    ...prefs,
  };
  const { data, error } = await supabase
    .from('shopping_lists')
    .update({ preferences: merged as never })
    .eq('id', listId)
    .select('preferences')
    .single();
  if (error || !data) failWith(ErrorCodes.INTERNAL);
  return ((data as { preferences: unknown }).preferences ?? {}) as Record<string, unknown>;
}
