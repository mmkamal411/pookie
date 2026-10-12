// /api/v1/support/tickets/[id] — user view of one ticket (non-internal events only).
import { apiHandler } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';
import { getUserTicket } from '@/lib/api';

export const GET = apiHandler({}, async (ctx) => {
  const supabase = await createClient();
  const ticketId = (ctx.params as { id: string }).id;
  return getUserTicket(supabase, ctx.userId, ticketId);
});
