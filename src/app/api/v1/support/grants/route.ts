// /api/v1/support/grants — agent requests break-glass data access.
// Scope allowlist enforced server-side; health/wellbeing/mood/check-in
// scopes are rejected (sol-support C1). Creates a pending grant; the
// consent card goes to the DATA OWNER (the ticket's user_id — the teen for
// teen-owned data, never the parent).
import { z } from 'zod';
import { apiHandler } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requestSupportGrant } from '@/lib/api';

const grantRequestSchema = z.object({
  ticketId: z.string().uuid(),
  scope: z.string().min(1).max(60),
  purpose: z.string().min(1).max(280),
});

export const POST = apiHandler({}, async (ctx, req) => {
  const body = grantRequestSchema.parse(await req.json());
  return requestSupportGrant(supabaseAdmin, {
    ticketId: body.ticketId,
    agentUserId: ctx.userId,
    scope: body.scope,
    purpose: body.purpose,
  });
});
