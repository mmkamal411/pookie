// PATCH /api/v1/household/shopping/items/[itemId] — two jobs, one route:
//
// 1. State transition (body has `status`): needed → claimed → bought, with
//    the sanctioned exceptions claimed → needed (unclaim) and needed → bought
//    (quick check-off). 409 CONFLICT on illegal transitions. A bought
//    transition carrying price_paid + store also learns a
//    shopping_price_reports row (receipt learning, best-effort — it never
//    fails the buy).
// 2. Field edit (body has no `status`): name / quantity / unit / note /
//    category. The adder or a parent may edit; rename collisions merge per
//    the add-dedupe rule.
//
// Anything → removed goes through the /remove route.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import {
  resolveHouseholdList,
  transitionItem,
  updateItemFields,
} from '@/server/services/shopping';

const transitionSchema = z.object({
  status: z.enum(['needed', 'claimed', 'bought']),
  store: z.string().max(80).optional(),
  price_paid: z.coerce.number().nonnegative().max(999999).optional(),
  list_id: z.string().uuid().optional(),
});

const fieldsSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    quantity: z.coerce.number().positive().max(9999).optional(),
    unit: z.string().max(20).nullable().optional(),
    note: z.string().max(300).nullable().optional(),
    category: z.string().max(20).optional(),
    list_id: z.string().uuid().optional(),
  })
  .refine(
    (b) =>
      b.name != null ||
      b.quantity != null ||
      b.unit !== undefined ||
      b.note !== undefined ||
      b.category != null,
    { message: 'Nothing to update.' },
  );

export const PATCH = handleRoute<{ itemId: string }>(async (ctx, req) => {
  const household = await assertHousehold();
  const raw = await req.json();
  const supabase = await createClient();

  if (raw != null && typeof raw === 'object' && 'status' in raw) {
    const body = transitionSchema.parse(raw);
    const list = await resolveHouseholdList(supabase, household, body.list_id);
    const item = await transitionItem(
      supabase,
      list.id,
      ctx.params.itemId,
      household.userId,
      body,
    );
    const auditAction =
      item.status === 'needed' ? 'shopping_item.unclaimed' : `shopping_item.${item.status}`;
    await auditEvent(household.anchorChildId, auditAction, {
      item_id: item.id,
      name: item.name,
    });
    return { item };
  }

  const body = fieldsSchema.parse(raw);
  const list = await resolveHouseholdList(supabase, household, body.list_id);
  const { item, merged } = await updateItemFields(
    supabase,
    list.id,
    ctx.params.itemId,
    household.userId,
    household.role,
    body,
  );
  await auditEvent(household.anchorChildId, 'shopping_item.edited', {
    item_id: item.id,
    name: item.name,
    merged,
  });
  return { item, merged };
});
