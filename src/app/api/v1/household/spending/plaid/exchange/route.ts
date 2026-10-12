// POST /api/v1/household/spending/plaid/exchange — exchange a Link
// public_token for an access token. The token is encrypted (pgp_sym_encrypt)
// before it touches plaid_items — plaintext exists only in memory during this
// call. Parent-only. Returns institution + masked accounts (never tokens).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { exchangePublicToken } from '@/server/services/plaid';

const exchangeSchema = z.object({
  public_token: z.string().min(1).max(500),
});

export const POST = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const body = exchangeSchema.parse(await req.json());
  const result = await exchangePublicToken(household.ownerUserId, body.public_token);
  await auditEvent(household.anchorChildId, 'plaid_item.connected', {
    plaid_item_id: result.plaid_item_id,
    institution: result.institution_name,
    accounts: result.accounts.length,
  });
  return result;
});
