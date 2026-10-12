// GET /api/v1/household/mail/[itemId] — the audited detail route (the ONLY
// route that returns ocr_text; the read is audit-logged per §0.5 exception).
// PATCH — set status (new/triaged/actioned/dismissed) and/or correct the
// extracted fields (sender, amount, due_date) from the confirm screen.
// The account field is never writable — account_last4 is pipeline-written only.
// No client DELETE — dismissal is status='dismissed' (ledger-like).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { createClient } from '@/lib/supabase/server';
import { getHouseholdMailItem } from '@/server/mail/common';
import { updateMailItem } from '@/server/services/mail';

type Params = { itemId: string };

const patchSchema = z.object({
  status: z.enum(['new', 'triaged', 'actioned', 'dismissed']).optional(),
  sender: z.string().max(120).nullable().optional(),
  amount: z.number().min(0).max(100_000_000).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const GET = handleRoute<Params>(async (ctx) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const supabase = await createClient();
  const item = await getHouseholdMailItem(supabase, household.ownerUserId, ctx.params.itemId, true);
  await auditEvent(household.anchorChildId, 'mail_item.read', {
    item_id: item.id,
  });
  return { item };
});

export const PATCH = handleRoute<Params>(async (ctx, req) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const body = patchSchema.parse(await req.json());
  const supabase = await createClient();
  const item = await updateMailItem(supabase, household.ownerUserId, ctx.params.itemId, {
    status: body.status ?? undefined,
    sender: body.sender ?? undefined,
    amount: body.amount ?? undefined,
    due_date: body.due_date ?? undefined,
  });
  await auditEvent(household.anchorChildId, 'mail_item.updated', {
    item_id: item.id,
    status: body.status ?? undefined,
  });
  return { item };
});
