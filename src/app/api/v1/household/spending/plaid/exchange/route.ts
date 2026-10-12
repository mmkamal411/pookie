// POST /api/v1/household/spending/plaid/exchange — exchange a Link
// public_token for an access token.
//
// WINDOW-NOT-VAULT (2026-10-12): The access token is returned to the phone,
// which stores it in the OS secure enclave (iOS Keychain / Android Keystore).
// The server NEVER persists it — plaintext exists only in memory during this
// call, then is discarded. The phone sends it back per-request for live
// fetches (blind-proxy pattern). Parent-only.
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
    // NOTE: access_token is intentionally NOT logged. It lives on the phone.
  });
  // The phone MUST store result.access_token in the secure enclave immediately.
  // This is the only time the server will ever see it.
  return {
    plaid_item_id: result.plaid_item_id,
    institution_name: result.institution_name,
    accounts: result.accounts,
    access_token: result.access_token,
  };
});
