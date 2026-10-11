// PATCH /api/v1/household/shopping/items/[itemId] — state transition.
// Forward-only per spec §2.3: needed → claimed → bought; claimed → needed
// (unclaim) allowed; anything → removed goes through the /remove route.
// 409 CONFLICT on illegal transitions. A bought transition carrying
// price_paid + store also learns a shopping_price_reports row (receipt
// learning, best-effort — it never fails the buy).
// DEVIATION from the spec's Zod sketch: 'needed' is accepted so the
// sanctioned unclaim (claimed → needed) is reachable via the API.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { resolveHouseholdList, transitionItem } from '@/server/services/shopping';

const transitionSchema = z.object({
  status: z.enum(['needed', 'claimed', 'bought']),
  store: z.string().max(80).optional(),
  price_paid: z.coerce.number().nonnegative().max(999999).optional(),
});

export const PATCH = handleRoute<{ itemId: string }>(async (ctx, req) => {
  const household = await assertHousehold();
  const body = transitionSchema.parse(await req.json());
  const supabase = await createClient();
  const list = await resolveHouseholdList(supabase, household);
  const item = await transitionItem(supabase, list.id, ctx.params.itemId, household.userId, body);
  const auditAction = item.status === 'needed' ? 'shopping_item.unclaimed' : `shopping_item.${item.status}`;
  await auditEvent(household.anchorChildId, auditAction, {
    item_id: item.id,
    name: item.name,
  });
  return { item };
});
