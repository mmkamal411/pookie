// /api/v1/support/tickets/[id]/claim — agent claims a ticket (open → in_progress).
// Sensitive tickets (P1 / child-authored) cannot be self-claimed by a plain
// agent — lead assignment required (sol-support §B.4). Family-linked agents
// are refused (conflict of interest).
import { apiHandler } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { claimTicket } from '@/lib/api';

export const POST = apiHandler({}, async (ctx) => {
  const ticketId = (ctx.params as { id: string }).id;
  await claimTicket(supabaseAdmin, ctx.userId, ticketId);
  return { claimed: true };
});
