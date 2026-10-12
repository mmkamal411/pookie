// POST /api/v1/household/mail/[itemId]/photo-delete — delete the raw photo
// NOW (user-initiated disposal, FTC Disposal Rule). The object is removed from
// the private mail-photos bucket and the row is stamped photo_purged_at; the
// extracted metadata (sender, amount, due date — all masked) stays in the
// mail file. Parent-only (Class S).
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { createClient } from '@/lib/supabase/server';
import { deleteMailPhotoNow } from '@/server/services/mail';

type Params = { itemId: string };

export const POST = handleRoute<Params>(async (ctx) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const supabase = await createClient();
  const item = await deleteMailPhotoNow(supabase, household.ownerUserId, ctx.params.itemId);
  await auditEvent(household.anchorChildId, 'mail_item.photo_purged', {
    item_id: item.id,
  });
  return { item };
});
