// POST /api/v1/village/mentors/consent — the child (13+) answers a pending grant.
import { handleRoute, auditEvent } from '@/server/rest';
import { answerMentorConsent, mentorConsentSchema } from '@/server/services/village';

export const POST = handleRoute(async (ctx, req) => {
  const input = mentorConsentSchema.parse(await req.json());
  const result = await answerMentorConsent(ctx.userId, input);
  return result;
});
