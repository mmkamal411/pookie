// PATCH /api/v1/household/mail/[itemId]/actions/[actionId] — resolve or
// snooze an extracted mail action. "The bill isn't done when the reminder
// fires": status 'done'/'cancelled' REQUIRES a resolution_note (zod refine),
// recorded on the row as the confirmation. Snooze moves reminder_at; 'open'
// re-arms the reminder. No client DELETE — ledger-like. Parent-only.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { createClient } from '@/lib/supabase/server';
import { getHouseholdMailAction, updateMailAction } from '@/server/mail/common';

type Params = { itemId: string; actionId: string };

const patchSchema = z
  .object({
    status: z.enum(['open', 'snoozed', 'done', 'cancelled']).optional(),
    resolution_note: z.string().max(500).nullable().optional(),
    reminder_at: z.string().datetime().nullable().optional(),
  })
  .refine(
    (b) =>
      (b.status === 'done' || b.status === 'cancelled'
        ? (b.resolution_note ?? '').trim().length > 0
        : true),
    { message: 'resolution_note is required to close an action' },
  );

export const PATCH = handleRoute<Params>(async (ctx, req) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const body = patchSchema.parse(await req.json());
  const supabase = await createClient();
  const action = await getHouseholdMailAction(
    supabase,
    household.ownerUserId,
    ctx.params.actionId,
  );
  if (action.mail_item_id !== ctx.params.itemId) failWith(ErrorCodes.NOT_FOUND);
  const updated = await updateMailAction(supabase, household.ownerUserId, action.id, {
    status: body.status ?? undefined,
    reminderAt: body.reminder_at ?? undefined,
    resolutionNote: body.resolution_note ?? undefined,
  });
  await auditEvent(household.anchorChildId, 'mail_action.updated', {
    action_id: action.id,
    status: body.status ?? undefined,
  });
  return { action: updated };
});
