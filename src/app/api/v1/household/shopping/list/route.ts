// GET /api/v1/household/shopping/list — the household list + visible items.
// resolve → assertHousehold → use → audit. `role`/`userId` are additive
// response fields the UI needs for role-gated actions (remove others' items,
// preferences) and "You" tags.
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { resolveHouseholdList, getVisibleItems } from '@/server/services/shopping';

export const GET = handleRoute(async () => {
  const ctx = await assertHousehold();
  const supabase = await createClient();
  const list = await resolveHouseholdList(supabase, ctx);
  const items = await getVisibleItems(supabase, list.id);
  await auditEvent(ctx.anchorChildId, 'shopping_list.viewed', { list_id: list.id });
  return { list, items, role: ctx.role, userId: ctx.userId };
});
