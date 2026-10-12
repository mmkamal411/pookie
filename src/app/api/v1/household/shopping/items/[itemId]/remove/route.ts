// POST /api/v1/household/shopping/items/[itemId]/remove — soft remove.
// Ledger-like by design: status='removed', terminal; no hard deletes anywhere.
// Route-level authorization per spec §2.2: anyone may remove their own items;
// removing ANOTHER member's item requires parent role (403 otherwise).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, failWith } from '@/server/errors';
import { resolveHouseholdList, getHouseholdItem, removeItem } from '@/server/services/shopping';

const removeSchema = z.object({
  reason: z.string().max(300).optional(),
  list_id: z.string().uuid().optional(),
});

export const POST = handleRoute<{ itemId: string }>(async (ctx, req) => {
  const household = await assertHousehold();
  const body = removeSchema.parse(await req.json().catch(() => ({})));
  const supabase = await createClient();
  const list = await resolveHouseholdList(supabase, household, body.list_id);
  const existing = await getHouseholdItem(supabase, list.id, ctx.params.itemId);
  if (existing.added_by !== household.userId && household.role !== 'parent') {
    failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  }
  const item = await removeItem(supabase, list.id, ctx.params.itemId);
  await auditEvent(household.anchorChildId, 'shopping_item.removed', {
    item_id: item.id,
    name: item.name,
    reason: body.reason ?? null,
  });
  return { item };
});
