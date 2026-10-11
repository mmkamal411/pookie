// POST /api/v1/household/shopping/items — add one item (added_by = caller).
// Dedupe-merge: a needed/claimed row with the same normalized name merges
// quantities and returns the existing row with merged: true.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { resolveHouseholdList, addItem } from '@/server/services/shopping';

const addItemSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.coerce.number().positive().max(9999).default(1),
  unit: z.string().max(20).optional(),
  note: z.string().max(300).optional(),
});

export const POST = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  const body = addItemSchema.parse(await req.json());
  const supabase = await createClient();
  const list = await resolveHouseholdList(supabase, household);
  const { item, merged } = await addItem(supabase, list.id, household.userId, body);
  await auditEvent(household.anchorChildId, 'shopping_item.added', {
    item_id: item.id,
    name: item.name,
    merged,
  });
  return { item, merged };
});
