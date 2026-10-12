// /api/v1/household/shopping/lists/[listId] — list management (parent only).
// PATCH {name}: rename. PATCH {is_default: true}: make it the default list.
// DELETE: delete the list (items, shares and price memories cascade;
// deleting the default promotes the oldest remaining list).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHouseholdParent } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import {
  renameHouseholdList,
  setDefaultHouseholdList,
  deleteHouseholdList,
} from '@/server/services/shopping';

const patchSchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    is_default: z.literal(true).optional(),
  })
  .refine((b) => b.name != null || b.is_default === true, {
    message: 'Nothing to update.',
  });

export const PATCH = handleRoute<{ listId: string }>(async (ctx, req) => {
  const household = await assertHouseholdParent();
  const body = patchSchema.parse(await req.json());
  const supabase = await createClient();
  const list = body.is_default
    ? await setDefaultHouseholdList(supabase, household.ownerUserId, ctx.params.listId)
    : await renameHouseholdList(supabase, household.ownerUserId, ctx.params.listId, body.name!);
  await auditEvent(household.anchorChildId, 'shopping_list.updated', {
    list_id: list.id,
    name: list.name,
    is_default: list.is_default,
  });
  return { list };
});

export const DELETE = handleRoute<{ listId: string }>(async (ctx) => {
  const household = await assertHouseholdParent();
  const supabase = await createClient();
  await deleteHouseholdList(supabase, household.ownerUserId, ctx.params.listId);
  await auditEvent(household.anchorChildId, 'shopping_list.deleted', {
    list_id: ctx.params.listId,
  });
  return { deleted: true };
});
