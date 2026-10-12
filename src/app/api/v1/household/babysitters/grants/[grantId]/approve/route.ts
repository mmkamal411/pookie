// POST /api/v1/household/babysitters/grants/[grantId]/approve — co-approve a grant.
// D6: teen co-approval (13–15) is required for NEW grantees; a teen approves
// with { as_teen: true } (instant — no cooling-off, safety action). A parent
// clears an 'installment_review' flag with { as_teen: false } after reviewing
// the flagged chain.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { approveGrant } from '@/server/services/babysitters';

type Params = { grantId: string };

const approveSchema = z.object({
  as_teen: z.boolean(),
});

export const POST = handleRoute<Params>(async (ctx, req) => {
  const household = await assertHousehold();
  const body = approveSchema.parse(await req.json());
  const supabase = await createClient();
  const grant = await approveGrant(supabase, ctx.params.grantId, household.userId, body.as_teen);
  await auditEvent(household.anchorChildId, 'sitter_grant.approved', {
    grant_id: grant.id,
    as_teen: body.as_teen,
  });
  return { grant };
});
