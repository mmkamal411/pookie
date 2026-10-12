// GET /api/v1/household/spending/summary — parent-only spending aggregates.
// This is the ONLY sanctioned way a parent sees teen spending: totals by
// category and month, including teen-private amounts, but NEVER merchant line
// items (FR-MOD-W11).
//
// WINDOW-NOT-VAULT (2026-10-12): Aggregates are computed from LIVE Plaid data
// (phone-held access token, per-request) + manual/CSV entries. Bank
// transactions are never persisted. The access token is accepted as a query
// param over TLS, used in memory, and discarded — never logged, never stored.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { getSpendingSummary } from '@/server/services/spending';

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Phone-held Plaid access token. Optional — without it, summary covers
  // manual/CSV entries only. Never logged, never stored.
  access_token: z.string().min(1).max(500).optional(),
});

export const GET = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  const params = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const supabase = await createClient();
  const summary = await getSpendingSummary(
    supabase,
    household.ownerUserId,
    params.from,
    params.to,
    params.access_token,
  );
  await auditEvent(household.anchorChildId, 'spending_summary.viewed', {});
  return { summary };
});
