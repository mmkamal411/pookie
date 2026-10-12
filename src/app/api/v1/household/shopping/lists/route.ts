// /api/v1/household/shopping/lists — the list switcher's data.
// GET: every list in the household with live open/bought counts.
// POST (parent only): create a new named list ("Weekly Groceries",
// "Costco Run", "Party Supplies", …).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold, assertHouseholdParent } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import {
  listHouseholdLists,
  createHouseholdList,
} from '@/server/services/shopping';

export const GET = handleRoute(async () => {
  const household = await assertHousehold();
  const supabase = await createClient();
  const lists = await listHouseholdLists(supabase, household.ownerUserId);
  return { lists };
});

const createSchema = z.object({
  name: z.string().min(1).max(60),
});

export const POST = handleRoute(async (ctx, req) => {
  const household = await assertHouseholdParent();
  const body = createSchema.parse(await req.json());
  const supabase = await createClient();
  const list = await createHouseholdList(supabase, household.ownerUserId, body.name);
  await auditEvent(household.anchorChildId, 'shopping_list.created', {
    list_id: list.id,
    name: list.name,
  });
  return { list };
});
