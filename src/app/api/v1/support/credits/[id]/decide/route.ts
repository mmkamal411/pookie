// /api/v1/support/credits/[id]/decide — MD decision on a credit approval.
// Only a support agent with role_tier='admin' (the Managing Director, D4)
// can decide. Approval writes the credit_issued event; denial is logged too.
import { z } from 'zod';
import { apiHandler } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { decideCreditApproval } from '@/lib/api';

const decideSchema = z.object({
  approve: z.boolean(),
  note: z.string().max(280).optional(),
});

export const POST = apiHandler({}, async (ctx, req) => {
  const approvalId = (ctx.params as { id: string }).id;
  const body = decideSchema.parse(await req.json());
  return decideCreditApproval(supabaseAdmin, {
    approvalId,
    deciderUserId: ctx.userId,
    approve: body.approve,
    note: body.note,
  });
});
