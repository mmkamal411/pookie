// /api/v1/support/credits — D4 tiered financial authority.
// POST { ticketId, amountCents, reason }:
//   ≤ $50  → issued directly in-ticket (ticket_events kind=credit_issued).
//   > $50  → approval_requested: a support_credit_approvals row is created
//            and the Managing Director (admin tier) decides at
//            /api/v1/support/credits/[id]/decide.
import { z } from 'zod';
import { apiHandler } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { issueOrRequestCredit } from '@/lib/api';

const creditSchema = z.object({
  ticketId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  reason: z.string().min(1).max(280),
});

export const POST = apiHandler({}, async (ctx, req) => {
  const body = creditSchema.parse(await req.json());
  return issueOrRequestCredit(supabaseAdmin, {
    ticketId: body.ticketId,
    agentUserId: ctx.userId,
    amountCents: body.amountCents,
    reason: body.reason,
  });
});
