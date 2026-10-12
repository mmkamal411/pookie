// POST /api/v1/household/spending/plaid/sync — fetch live transactions from Plaid.
//
// WINDOW-NOT-VAULT (2026-10-12): This is now fetch-on-view, NOT sync-and-store.
// Bank transactions are fetched live from Plaid, returned in the response, and
// discarded. Nothing is written to the transactions table. The `transactions`
// table holds only manual/CSV entries (the user's own data).
//
// Parent-only. Returns live transaction data merged with the user's annotations.
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { fetchTransactionsLive } from '@/server/services/plaid';

export const POST = handleRoute(async () => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const { transactions, has_more } = await fetchTransactionsLive(household.ownerUserId, {
    count: 200,
  });
  await auditEvent(household.anchorChildId, 'plaid_live_fetch.completed', {
    count: transactions.length,
  });
  return { transactions, has_more, live: true };
});
