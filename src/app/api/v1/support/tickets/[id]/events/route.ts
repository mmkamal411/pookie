// /api/v1/support/tickets/[id]/events — post a message to a ticket.
// Users post on their own tickets; agents post via the agent console path
// (authorType 'agent' requires an active support_agents row).
//
// Squad 5 (S5-007/S5-008): accepts kind 'ai_transcript' so the S2 handoff can
// attach the chat transcript as its own thread row (BACKEND-CONTRACTS §2 —
// rendered collapsed in the UI). Users may only write 'message' or
// 'ai_transcript'; 'internal' is forced false for non-agents.
import { z } from 'zod';
import { apiHandler } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { postTicketEvent } from '@/lib/api';

const eventSchema = z.object({
  body: z.string().min(1).max(8000),
  internal: z.boolean().optional(),
  asAgent: z.boolean().optional(),
  kind: z.enum(['message', 'ai_transcript']).optional(),
});

export const POST = apiHandler({}, async (ctx, req) => {
  const ticketId = (ctx.params as { id: string }).id;
  const body = eventSchema.parse(await req.json());
  const isAgent = body.asAgent === true;
  const eventId = await postTicketEvent(supabaseAdmin, {
    ticketId,
    authorType: isAgent ? 'agent' : 'user',
    authorId: ctx.userId,
    body: body.body,
    internal: isAgent ? (body.internal ?? false) : false,
    kind: body.kind ?? (isAgent ? 'agent_reply' : 'message'),
  });
  return { eventId };
});
