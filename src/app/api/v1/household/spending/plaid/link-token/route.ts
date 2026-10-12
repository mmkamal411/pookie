// POST /api/v1/household/spending/plaid/link-token — create a Plaid Link
// token so the owner can connect a bank. Parent-only (tokens are the crown
// jewels). Requires PLAID_CLIENT_ID / PLAID_SECRET (sandbox by default via
// PLAID_ENV); without them the service raises UPSTREAM_UNAVAILABLE —
// everything else in W11 works without Plaid.
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { createLinkToken } from '@/server/services/plaid';

export const POST = handleRoute(async () => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const result = await createLinkToken(household.ownerUserId);
  await auditEvent(household.anchorChildId, 'plaid_link_token.created', {});
  return result;
});
