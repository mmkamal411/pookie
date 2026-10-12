// GET /api/v1/household/babysitters/[sitterId]/grants — the sitter's grants.
// POST — request a time-boxed grant. D6 enforcement (tiered caps: 8/30d
// trusted, 2/30d first-time; installment detection; teen co-approval for new
// grantees 13–15; scope allowlist; block propagation) runs inside the
// request_sitter_grant() RPC. Body carries childId (a selection, never
// authorization — assertTenant scopes it).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold, assertTenant } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { listGrants, requestGrant } from '@/server/services/babysitters';

type Params = { sitterId: string };

const requestSchema = z.object({
  child_id: z.string().uuid(),
  purpose: z.string().min(1).max(60),
  starts_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  scope: z.array(z.string().max(40)).max(10).optional(),
});

export const GET = handleRoute<Params>(async (ctx) => {
  const household = await assertHousehold();
  const supabase = await createClient();
  const grants = await listGrants(supabase, ctx.params.sitterId);
  return { grants };
});

export const POST = handleRoute<Params>(async (ctx, req) => {
  const household = await assertHousehold();
  const body = requestSchema.parse(await req.json());
  const tenant = await assertTenant(body.child_id);
  const supabase = await createClient();
  const grant = await requestGrant(supabase, ctx.params.sitterId, tenant.childId, body);
  await auditEvent(tenant.childId, 'sitter_grant.requested', {
    grant_id: grant.id,
    sitter_id: ctx.params.sitterId,
    grantee_tier: grant.grantee_tier,
    teen_coapproval_status: grant.teen_coapproval_status,
  });
  return { grant };
});
