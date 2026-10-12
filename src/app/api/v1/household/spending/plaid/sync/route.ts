// POST /api/v1/household/spending/plaid/sync — fetch live transactions from Plaid.
//
// WINDOW-NOT-VAULT (2026-10-12): This is fetch-on-view, NOT sync-and-store.
// The phone sends its Plaid access token (from the OS secure enclave) per
// request. The server attaches the Plaid secret, calls Plaid, returns the data,
// and discards the token from memory. Nothing is written to any table.
// The `transactions` table holds only manual/CSV entries (the user's own data).
//
// Parent-only. Returns live transaction data merged with the user's annotations.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { fetchTransactionsLive } from '@/server/services/plaid';

const syncSchema = z.object({
  // Phone-held Plaid access token (secure enclave). Never logged, never stored.
  access_token: z.string().min(1).max(500),
  count: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export const POST = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const body = syncSchema.parse(await req.json());
  const { transactions, has_more } = await fetchTransactionsLive(
    household.ownerUserId,
    body.access_token,
    { count: body.count ?? 200, offset: body.offset ?? 0 },
  );
  await auditEvent(household.anchorChildId, 'plaid_live_fetch.completed', {
    count: transactions.length,
    // NOTE: access_token intentionally omitted from audit log.
  });
  return { transactions, has_more, live: true };
});
