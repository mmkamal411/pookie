// Squad Village — shared shopping lists between families ("linking ships").
//
// A household list owner shares their list with another family's user by
// email. Share recipients get live read + add/check-off via the additive
// RLS policies in migration 069. All queries run through the user-JWT
// client; no service_role here, ever.
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, failWith } from '@/server/errors';

type Db = Awaited<ReturnType<typeof createClient>>;

export const shareListSchema = z.object({
  email: z.string().email().max(320),
});

export interface ListShare {
  id: string;
  list_id: string;
  shared_with_user_id: string;
  shared_with_email: string | null;
  shared_with_name: string | null;
  status: string;
  created_at: string;
}

/** The caller's own household list id (owner = caller). */
async function myListId(supabase: Db, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('owner_user_id', userId)
    .single();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
  return (data as { id: string }).id;
}

async function lookupUserByEmail(
  supabase: Db,
  email: string,
): Promise<{ id: string; email: string; display_name: string | null } | null> {
  const { data } = await supabase
    .from('users')
    .select('id, email, display_name')
    .ilike('email', email.trim())
    .single();
  return (data as { id: string; email: string; display_name: string | null } | null) ?? null;
}

/** Lists the caller shares OUT (as owner) and shares IN (as recipient). */
export async function listMyShares(userId: string): Promise<{
  shared_out: ListShare[];
  shared_in: { list_id: string; owner_email: string | null; owner_name: string | null }[];
}> {
  const supabase = await createClient();
  const listId = await myListId(supabase, userId).catch(() => null);

  let shared_out: ListShare[] = [];
  if (listId) {
    const { data } = await supabase
      .from('shopping_list_shares')
      .select('id, list_id, shared_with_user_id, status, created_at')
      .eq('list_id', listId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as Record<string, unknown>[];
    const ids = rows.map((r) => r.shared_with_user_id as string);
    const names = new Map<string, { email: string; display_name: string | null }>();
    if (ids.length) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, display_name')
        .in('id', ids);
      for (const u of (users ?? []) as { id: string; email: string; display_name: string | null }[]) {
        names.set(u.id, { email: u.email, display_name: u.display_name });
      }
    }
    shared_out = rows.map((r) => ({
      id: r.id as string,
      list_id: r.list_id as string,
      shared_with_user_id: r.shared_with_user_id as string,
      shared_with_email: names.get(r.shared_with_user_id as string)?.email ?? null,
      shared_with_name: names.get(r.shared_with_user_id as string)?.display_name ?? null,
      status: r.status as string,
      created_at: r.created_at as string,
    }));
  }

  const { data: inRows } = await supabase
    .from('shopping_list_shares')
    .select('list_id')
    .eq('shared_with_user_id', userId)
    .eq('status', 'active');
  const shared_in: { list_id: string; owner_email: string | null; owner_name: string | null }[] = [];
  for (const r of (inRows ?? []) as { list_id: string }[]) {
    const { data: list } = await supabase
      .from('shopping_lists')
      .select('owner_user_id')
      .eq('id', r.list_id)
      .single();
    const ownerId = (list as { owner_user_id: string } | null)?.owner_user_id;
    let owner_email: string | null = null;
    let owner_name: string | null = null;
    if (ownerId) {
      const { data: owner } = await supabase
        .from('users')
        .select('email, display_name')
        .eq('id', ownerId)
        .single();
      owner_email = (owner as { email: string } | null)?.email ?? null;
      owner_name = (owner as { display_name: string } | null)?.display_name ?? null;
    }
    shared_in.push({ list_id: r.list_id, owner_email, owner_name });
  }

  return { shared_out, shared_in };
}

/** Share the caller's household list with another Pookie user by email. */
export async function shareListWith(
  userId: string,
  email: string,
): Promise<{ share_id: string }> {
  const supabase = await createClient();
  const listId = await myListId(supabase, userId);
  const target = await lookupUserByEmail(supabase, email);
  if (!target) {
    // No enumeration-safe generic error needed here: the owner explicitly
    // typed an email; telling them it has no Pookie account is helpful.
    failWith(ErrorCodes.NOT_FOUND);
  }
  if (target.id === userId) failWith(ErrorCodes.CONFLICT);

  const { data, error } = await supabase
    .from('shopping_list_shares')
    .upsert(
      {
        list_id: listId,
        shared_with_user_id: target.id,
        granted_by_user_id: userId,
        status: 'active',
      },
      { onConflict: 'list_id,shared_with_user_id' },
    )
    .select('id')
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  return { share_id: (data as { id: string }).id };
}

/** Owner revokes a share. Recipients leave via leaveSharedList. */
export async function revokeShare(userId: string, shareId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('shopping_list_shares')
    .update({ status: 'revoked' })
    .eq('id', shareId)
    .eq('status', 'active');
  if (error) failWith(ErrorCodes.INTERNAL);
  // RLS (owner_manage) enforces that only the list owner can revoke.
}

/** A recipient leaves a shared list (marks their own share revoked). */
export async function leaveSharedList(userId: string, listId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('shopping_list_shares')
    .update({ status: 'revoked' })
    .eq('list_id', listId)
    .eq('shared_with_user_id', userId)
    .eq('status', 'active');
  if (error) failWith(ErrorCodes.INTERNAL);
}

// ---------------------------------------------------------------------------
// Shared-list item operations — RLS (can_access_shopping_list) is the gate.
// These let share recipients view/add/check-off on a list shared with them.
// ---------------------------------------------------------------------------

/** Resolve a list the caller may access (own household list or shared). */
async function resolveAccessibleList(
  supabase: Db,
  listId: string,
): Promise<{ id: string; owner_user_id: string; name: string }> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('id, owner_user_id, name')
    .eq('id', listId)
    .single();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
  return data as { id: string; owner_user_id: string; name: string };
}

export interface SharedListView {
  list: { id: string; name: string; owner_name: string | null };
  items: {
    id: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    note: string | null;
    status: string;
    added_by_name: string | null;
    claimed_by: string | null;
    bought_by: string | null;
    store: string | null;
    created_at: string;
  }[];
}

/** Full view of a shared list for a recipient. */
export async function getSharedListView(userId: string, listId: string): Promise<SharedListView> {
  const supabase = await createClient();
  const list = await resolveAccessibleList(supabase, listId);
  // RLS: the SELECT above already enforced access; belt-and-suspenders check.
  const { data: access } = await supabase.rpc('can_access_shopping_list', {
    p_list_id: listId,
  });
  if (!access) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);

  const { data: owner } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', list.owner_user_id)
    .single();

  const { data: items } = await supabase
    .from('shopping_items')
    .select('id, name, quantity, unit, note, status, added_by, claimed_by, bought_by, store, created_at')
    .eq('list_id', listId)
    .neq('status', 'removed')
    .order('created_at', { ascending: true });
  const rows = (items ?? []) as Record<string, unknown>[];
  const adderIds = [...new Set(rows.map((r) => r.added_by as string).filter(Boolean))];
  const names = new Map<string, string>();
  if (adderIds.length) {
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, email')
      .in('id', adderIds);
    for (const u of (users ?? []) as { id: string; display_name: string | null; email: string }[]) {
      names.set(u.id, u.display_name ?? u.email);
    }
  }

  return {
    list: {
      id: list.id,
      name: list.name,
      owner_name: (owner as { display_name: string | null } | null)?.display_name ?? null,
    },
    items: rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      quantity: (r.quantity as number | null) ?? null,
      unit: (r.unit as string | null) ?? null,
      note: (r.note as string | null) ?? null,
      status: r.status as string,
      added_by_name: r.added_by ? (names.get(r.added_by as string) ?? null) : null,
      claimed_by: (r.claimed_by as string | null) ?? null,
      bought_by: (r.bought_by as string | null) ?? null,
      store: (r.store as string | null) ?? null,
      created_at: r.created_at as string,
    })),
  };
}

/** Add an item to a shared list (added_by = caller). */
export async function addSharedItem(
  userId: string,
  listId: string,
  input: { name: string; quantity?: number; unit?: string; note?: string },
): Promise<{ item_id: string }> {
  const supabase = await createClient();
  await resolveAccessibleList(supabase, listId);
  const { data, error } = await supabase
    .from('shopping_items')
    .insert({
      list_id: listId,
      name: input.name.trim(),
      quantity: input.quantity ?? 1,
      unit: input.unit?.trim() || null,
      note: input.note?.trim() || null,
      status: 'needed',
      added_by: userId,
      source: 'manual',
    })
    .select('id')
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  return { item_id: (data as { id: string }).id };
}

/** Transition an item on a shared list (claim / buy / unclaim). */
export async function transitionSharedItem(
  userId: string,
  listId: string,
  itemId: string,
  status: 'needed' | 'claimed' | 'bought',
): Promise<{ status: string }> {
  const supabase = await createClient();
  await resolveAccessibleList(supabase, listId);
  const patch: Record<string, unknown> = { status };
  if (status === 'claimed') patch.claimed_by = userId;
  if (status === 'needed') patch.claimed_by = null;
  if (status === 'bought') {
    patch.bought_by = userId;
    patch.bought_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from('shopping_items')
    .update(patch)
    .eq('id', itemId)
    .eq('list_id', listId);
  if (error) failWith(ErrorCodes.INTERNAL);
  return { status };
}
