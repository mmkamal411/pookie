// POST /api/v1/household/spending/plaid/sync — run transactions/sync for all
// of the owner's active Plaid connections. Idempotent (upsert on
// plaid_transaction_id). Parent-only.
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { syncAllPlaidItems } from '@/server/services/plaid';

export const POST = handleRoute(async () => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const results = await syncAllPlaidItems(household.ownerUserId);
  await auditEvent(household.anchorChildId, 'plaid_sync.completed', {
    items: results.length,
  });
  return { results };
});
