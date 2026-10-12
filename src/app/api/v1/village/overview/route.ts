// GET /api/v1/village/overview?child_id=… — the mentor's scoped school view.
// The caller must hold an active mentor grant; RLS scopes classes/grades/
// assignments. The view is audit-logged (mentor_access_log).
import { z } from 'zod';
import { handleRoute } from '@/server/rest';
import { mentorOverview } from '@/server/services/village';

export const GET = handleRoute(async (ctx, req) => {
  const { child_id } = z
    .object({ child_id: z.string().uuid() })
    .parse(Object.fromEntries(new URL(req.url).searchParams.entries()));
  return mentorOverview(ctx.userId, child_id);
});
