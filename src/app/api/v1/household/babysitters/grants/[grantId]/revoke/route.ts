// POST /api/v1/household/babysitters/grants/[grantId]/revoke — revoke a grant.
// Either the parent or the teen may revoke, instantly, with no cooling-off.
// { revoked_by: 'parent' | 'teen' }.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { revokeGrant } from '@/server/services/babysitters';

type Params = { grantId: string };

const revokeSchema = z.object({
  revoked_by: z.enum(['parent', 'teen']),
});

export const POST = handleRoute<Params>(async (ctx, req) => {
  const household = await assertHousehold();
  const body = revokeSchema.parse(await req.json());
  const supabase = await createClient();
  await revokeGrant(supabase, ctx.params.grantId, body.revoked_by);
  await auditEvent(household.anchorChildId, 'sitter_grant.revoked', {
    grant_id: ctx.params.grantId,
    revoked_by: body.revoked_by,
  });
  return { revoked: true };
});
