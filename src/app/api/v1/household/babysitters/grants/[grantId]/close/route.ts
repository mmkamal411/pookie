// POST /api/v1/household/babysitters/grants/[grantId]/close — close out a grant.
// D6 tier source: a clean completion promotes the sitter to 'trusted'
// (8/30d cap); { blocked: true } records a block — the sitter gets no future
// grants. Parent-only.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { createClient } from '@/lib/supabase/server';
import { closeGrant } from '@/server/services/babysitters';

type Params = { grantId: string };

const closeSchema = z.object({
  blocked: z.boolean(),
});

export const POST = handleRoute<Params>(async (ctx, req) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const body = closeSchema.parse(await req.json());
  const supabase = await createClient();
  const sitter = await closeGrant(supabase, ctx.params.grantId, body.blocked);
  await auditEvent(household.anchorChildId, 'sitter_grant.closed', {
    grant_id: ctx.params.grantId,
    blocked: body.blocked,
    trust_tier: sitter.trust_tier,
  });
  return { sitter };
});
