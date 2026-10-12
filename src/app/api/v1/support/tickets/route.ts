// /api/v1/support/tickets — S3 ticket desk (user side).
// GET: the caller's own tickets (teen-owned tickets are invisible to parents
// by construction: ownership is the teen's user_id — FR-SUPPORT-004).
// POST: open a ticket. sla_due_at is computed window-aware (4h within
// 09:00–17:00 ET, 7 days/week); holiday filings auto-assign the on-call
// agent (MD decision D4).
import { z } from 'zod';
import { apiHandler } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { listUserTickets, openTicket } from '@/lib/api';

const openTicketSchema = z.object({
  childId: z.string().uuid().nullable().optional(),
  category: z.string().min(1).max(60),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
  source: z.enum(['s2_escalation', 'manual', 'faq']).optional(),
  teenPrivacy: z.boolean().optional(),
  priority: z.enum(['P1', 'P2', 'P3']).optional(),
});

export const GET = apiHandler({}, async (ctx) => {
  const supabase = await createClient();
  return listUserTickets(supabase, ctx.userId);
});

export const POST = apiHandler({}, async (ctx, req) => {
  const body = openTicketSchema.parse(await req.json());
  const ticket = await openTicket(supabaseAdmin, {
    userId: ctx.userId,
    childId: body.childId ?? null,
    category: body.category,
    subject: body.subject,
    body: body.body,
    source: body.source,
    teenPrivacy: body.teenPrivacy,
    priority: body.priority,
  });
  return ticket;
});
