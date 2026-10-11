// /api/v1/household/shopping/prices — the "did we overpay?" memory.
// GET: newest-first, filterable by item and store. POST: append-only report
// (user-reported prices ONLY — never scraped, never presented as live).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { resolveHouseholdList, getPriceReports, reportPrice } from '@/server/services/shopping';

export const GET = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  const params = req.nextUrl.searchParams;
  const supabase = await createClient();
  const list = await resolveHouseholdList(supabase, household);
  const prices = await getPriceReports(supabase, list.id, {
    item: params.get('item') ?? undefined,
    store: params.get('store') ?? undefined,
  });
  return { prices };
});

const reportSchema = z.object({
  item_name: z.string().min(1).max(120),
  store: z.string().min(1).max(80),
  price: z.coerce.number().nonnegative().max(999999),
  reported_at: z.string().date().optional(),
});

export const POST = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  const body = reportSchema.parse(await req.json());
  const supabase = await createClient();
  const list = await resolveHouseholdList(supabase, household);
  const report = await reportPrice(supabase, list.id, household.userId, body);
  await auditEvent(household.anchorChildId, 'price.reported', {
    item_name: report.item_name,
    store: report.store,
    price: report.price,
  });
  return { report };
});
