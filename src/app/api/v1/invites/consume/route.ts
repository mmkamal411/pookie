// POST /api/v1/invites/consume — consume an invite token after OTP login.
// Wraps the consume_invite() SECURITY DEFINER RPC (which enforces the
// audit-fixed invite policies: parent-only minting, email match, expiry).
// Audited against the resulting child_id.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { createClient } from '@/lib/supabase/server';
import { ApiError, mapDbError } from '@/server/errors';

const consumeSchema = z.object({
  token: z.string().min(16).max(128),
});

export const POST = handleRoute(async (ctx, req) => {
  const { token } = consumeSchema.parse(await req.json());
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('consume_invite', {
    p_token: token,
  });
  if (error) throw new ApiError(mapDbError(error, ctx.requestId));
  const childId = data as string;
  await auditEvent(childId, 'invite_consumed');
  return { childId };
});
