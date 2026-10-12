// GET /api/v1/household/mail/actions — the action-item feeds.
//   ?scope=due&window=7  — the "Up next" feed: open/snoozed actions due within
//                          `window` days (default 7, max 30), due-date order.
//   ?scope=open          — all open/snoozed actions (for the card panels).
// Metadata only (no OCR text, no account fragments). Parent-only (Class S).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { createClient } from '@/lib/supabase/server';
import { listDueActions, listOpenActions } from '@/server/mail/common';

const querySchema = z.object({
  scope: z.enum(['due', 'open']).default('due'),
  window: z.coerce.number().int().positive().max(30).default(7),
});

export const GET = handleRoute(async (_ctx, req) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const { scope, window } = querySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  const supabase = await createClient();
  const actions =
    scope === 'open'
      ? await listOpenActions(supabase, household.ownerUserId)
      : await listDueActions(supabase, household.ownerUserId, window);
  await auditEvent(household.anchorChildId, 'mail_actions.viewed', {
    scope,
    count: actions.length,
  });
  return { actions };
});
