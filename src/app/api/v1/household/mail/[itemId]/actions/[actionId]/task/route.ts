// POST /api/v1/household/mail/[itemId]/actions/[actionId]/task — one-tap
// "Remind me": creates a household task (Family Task System) carrying the
// action's due date, and resolves the mail action with a resolution note.
// Reminders fire through the household task list — no duplicate surfaces.
// Parent-only.
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { createClient } from '@/lib/supabase/server';
import { getHouseholdMailAction, updateMailAction } from '@/server/mail/common';
import { createTask } from '@/server/services/tasks';

type Params = { itemId: string; actionId: string };

export const POST = handleRoute<Params>(async (ctx) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const supabase = await createClient();
  const action = await getHouseholdMailAction(
    supabase,
    household.ownerUserId,
    ctx.params.actionId,
  );
  if (action.mail_item_id !== ctx.params.itemId) failWith(ErrorCodes.NOT_FOUND);
  if (action.status === 'done' || action.status === 'cancelled') {
    failWith(ErrorCodes.CONFLICT);
  }

  const { task } = await createTask({
    title: action.title,
    notes: action.detail ?? undefined,
    due_date: action.due_date ?? undefined,
    priority: action.kind === 'pay' ? 'high' : 'normal',
    category: 'mail',
    source: 'mail',
  });

  const resolved = await updateMailAction(supabase, household.ownerUserId, action.id, {
    status: 'done',
    resolutionNote: 'Reminder created in household tasks.',
  });
  await auditEvent(household.anchorChildId, 'mail_action.reminder_created', {
    action_id: action.id,
  });
  return { task, action: resolved };
});
