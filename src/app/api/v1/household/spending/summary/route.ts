// GET /api/v1/household/spending/summary — parent-only spending aggregates.
// This is the ONLY sanctioned way a parent sees teen spending: totals by
// category and month, including teen-private amounts, but NEVER merchant line
// items (FR-MOD-W11). The spending_summary() RPC enforces the parent check
// server-side; non-parents get PARENT_ROLE_REQUIRED.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { getSpendingSummary } from '@/server/services/spending';

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  const params = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const supabase = await createClient();
  const summary = await getSpendingSummary(supabase, household.ownerUserId, params.from, params.to);
  await auditEvent(household.anchorChildId, 'spending_summary.viewed', {});
  return { summary };
});
