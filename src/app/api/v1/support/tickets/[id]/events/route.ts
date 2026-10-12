// /api/v1/support/tickets/[id]/events — post a message to a ticket.
// Users post on their own tickets; agents post via the agent console path
// (authorType 'agent' requires an active support_agents row).
import { z } from 'zod';
import { apiHandler } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { postTicketEvent } from '@/lib/api';

const eventSchema = z.object({
  body: z.string().min(1).max(8000),
  internal: z.boolean().optional(),
  asAgent: z.boolean().optional(),
});

export const POST = apiHandler({}, async (ctx, req) => {
  const ticketId = (ctx.params as { id: string }).id;
  const body = eventSchema.parse(await req.json());
  const eventId = await postTicketEvent(supabaseAdmin, {
    ticketId,
    authorType: body.asAgent ? 'agent' : 'user',
    authorId: ctx.userId,
    body: body.body,
    internal: body.internal ?? false,
  });
  return { eventId };
});
