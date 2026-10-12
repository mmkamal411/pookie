// /api/v1/support/tickets/[id]/transition — validated status transition.
// open → in_progress → resolved → closed (sol-support §D.2).
// Resolved requires the USER's confirmation before closed; the user can
// reopen from resolved/closed. Every transition is allowlisted in grants.ts.
import { z } from 'zod';
import { apiHandler } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { transitionTicket } from '@/lib/api';
import type { TicketActor, TicketStatus } from '@/lib/api';

const transitionSchema = z.object({
  to: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  actor: z.enum(['user', 'agent', 'lead', 'system']),
});

export const POST = apiHandler({}, async (ctx, req) => {
  const ticketId = (ctx.params as { id: string }).id;
  const body = transitionSchema.parse(await req.json());
  await transitionTicket(
    supabaseAdmin,
    ticketId,
    body.to as TicketStatus,
    body.actor as TicketActor,
    ctx.userId,
  );
  return { transitioned: true, to: body.to };
});
