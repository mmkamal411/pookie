// GET /api/v1/household/mail/[itemId]/actions — the action items extracted
// from one mail item (created by the OCR pipeline: pay bills, review legal
// or insurance documents). Metadata only. Parent-only.
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { createClient } from '@/lib/supabase/server';
import { getHouseholdMailItem, listMailActions } from '@/server/mail/common';

type Params = { itemId: string };

export const GET = handleRoute<Params>(async (ctx) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const supabase = await createClient();
  // 404 when the item isn't in this household — the actions stay scoped too.
  await getHouseholdMailItem(supabase, household.ownerUserId, ctx.params.itemId);
  const actions = await listMailActions(supabase, household.ownerUserId, ctx.params.itemId);
  await auditEvent(household.anchorChildId, 'mail_actions.viewed', {
    item_id: ctx.params.itemId,
    count: actions.length,
  });
  return { actions };
});
