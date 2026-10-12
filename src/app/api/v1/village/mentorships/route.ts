// GET /api/v1/village/mentorships — children the caller actively mentors.
import { handleRoute } from '@/server/rest';
import { myMentorships } from '@/server/services/village';

export const GET = handleRoute(async (ctx) => {
  return myMentorships(ctx.userId);
});
