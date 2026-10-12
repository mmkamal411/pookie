// GET /api/v1/household/shopping/list — the household list + visible items.
// ?list_id= targets a specific list (the switcher); omitted → the default.
// resolve → assertHousehold → use → audit. `role`/`userId` are additive
// response fields the UI needs for role-gated actions (remove others' items,
// preferences) and "You" tags. `frequent` feeds the one-tap re-add row.
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import {
  resolveHouseholdList,
  getVisibleItems,
  getFrequentItems,
} from '@/server/services/shopping';

export const GET = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  const listId = new URL(req.url).searchParams.get('list_id') ?? undefined;
  const supabase = await createClient();
  const list = await resolveHouseholdList(supabase, household, listId);
  const items = await getVisibleItems(supabase, list.id);
  const frequent = await getFrequentItems(supabase, list.id);
  await auditEvent(household.anchorChildId, 'shopping_list.viewed', {
    list_id: list.id,
  });
  return { list, items, frequent, role: household.role, userId: household.userId };
});
