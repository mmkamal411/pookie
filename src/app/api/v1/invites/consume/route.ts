// POST /api/v1/invites/consume — consume an invite token after OTP login.
// Wraps the consume_invite() SECURITY DEFINER RPC (which enforces the
// audit-fixed invite policies: parent-only minting, email match, expiry).
// Audited against the resulting child_id.
//
// SEC-002 (2026-10-12): the old code returned distinct INVITE_NOT_FOUND vs
// INVITE_EMAIL_MISMATCH — an enumeration oracle ("token invalid" vs "token
// valid, wrong email"). Both now collapse to the single INVITE_NOT_FOUND
// code/message (see mapDbError), and the endpoint is per-user throttled
// (10 attempts / 10 min) with failures audited to access_events.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { createClient } from '@/lib/supabase/server';
import { ApiError, ErrorCodes } from '@/server/errors';
import {
  auditInviteConsumeFailure,
  checkInviteConsumeThrottle,
  recordInviteConsumeAttempt,
} from '@/server/invite-throttle';

const consumeSchema = z.object({
  token: z.string().min(16).max(128),
});

export const POST = handleRoute(async (ctx, req) => {
  const { token } = consumeSchema.parse(await req.json());
  const supabase = await createClient();
  await checkInviteConsumeThrottle(supabase, ctx.userId);
  const { data, error } = await supabase.rpc('consume_invite', {
    p_token: token,
  });
  await recordInviteConsumeAttempt(supabase, ctx.userId, !error);
  if (error) {
    // Single code/message for every failure mode — no oracle.
    await auditInviteConsumeFailure(supabase, ctx.userId);
    throw new ApiError(ErrorCodes.INVITE_NOT_FOUND);
  }
  const childId = data as string;
  await auditEvent(childId, 'invite_consumed');
  return { childId };
});
