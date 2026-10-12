// POST /api/v1/household/mail/[itemId]/actions/[actionId]/bill — one-tap
// "Pay $X": creates a Bill Tracker row from the extracted action (name,
// payee, amount, due date carried over) and resolves the mail action with a
// resolution note. The action stays ledger-like — nothing is deleted.
// Parent-only.
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { createClient } from '@/lib/supabase/server';
import {
  getHouseholdMailAction,
  getHouseholdMailItem,
  updateMailAction,
} from '@/server/mail/common';
import { createBill } from '@/server/services/bills';

type Params = { itemId: string; actionId: string };

export const POST = handleRoute<Params>(async (ctx) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const supabase = await createClient();
  const item = await getHouseholdMailItem(supabase, household.ownerUserId, ctx.params.itemId);
  const action = await getHouseholdMailAction(
    supabase,
    household.ownerUserId,
    ctx.params.actionId,
  );
  if (action.mail_item_id !== item.id) failWith(ErrorCodes.NOT_FOUND);
  if (action.status === 'done' || action.status === 'cancelled') {
    failWith(ErrorCodes.CONFLICT);
  }

  const amount = action.amount != null ? Number(action.amount) : null;
  const { bill } = await createBill({
    name: action.title,
    payee: item.sender ?? undefined,
    amount: amount != null && amount > 0 ? amount : undefined,
    due_date: action.due_date ?? undefined,
    recurrence: 'once',
    category: 'mail',
    status: 'unpaid',
    notes: `From scanned mail · ${item.sender ?? 'unknown sender'}${
      item.account_last4 ? ` · account •••• ${item.account_last4}` : ''
    }`,
  });

  const resolved = await updateMailAction(supabase, household.ownerUserId, action.id, {
    status: 'done',
    resolutionNote: 'Sent to Bills — tracked as an unpaid bill.',
  });
  await auditEvent(household.anchorChildId, 'mail_action.sent_to_bills', {
    action_id: action.id,
  });
  return { bill, action: resolved };
});
