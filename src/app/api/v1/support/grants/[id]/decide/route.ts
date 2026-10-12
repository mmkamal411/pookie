// /api/v1/support/grants/[id]/decide — the data owner approves/denies.
// Only the ticket's user_id (the teen for teen-owned data) can decide.
// Approved grants activate with a TTL (default 24h, hard cap 72h); every
// scoped read under the grant is audit-logged.
import { z } from 'zod';
import { apiHandler } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { decideSupportGrant } from '@/lib/api';

const decideSchema = z.object({
  approve: z.boolean(),
  ttlHours: z.number().int().min(1).max(72).optional(),
});

export const POST = apiHandler({}, async (ctx, req) => {
  const grantId = (ctx.params as { id: string }).id;
  const body = decideSchema.parse(await req.json());
  await decideSupportGrant(supabaseAdmin, {
    grantId,
    deciderUserId: ctx.userId,
    approve: body.approve,
    ttlHours: body.ttlHours,
  });
  return { decided: true, approved: body.approve };
});
