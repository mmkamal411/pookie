// GET /api/v1/health/subjects/[subjectId]/nutrition/closeout?date=YYYY-MM-DD
// The gentle daily closeout: totals vs target, short-only gaps citing
// real whole foods (food_swaps), shame-free copy. Diary holders only.
import { z } from 'zod';
import { handleRoute } from '@/server/rest';
import { assertHealthSubject } from '@/server/tenant';
import { DOCTOR_RAIL, REAL_FOOD_FIRST } from '@/server/health/copy';
import { getDayCloseout } from '@/server/services/nutrition';

const dateQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

export const GET = handleRoute<{ subjectId: string }>(async (ctx, req) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  const url = new URL(req.url);
  const { date } = dateQuery.parse({
    date:
      url.searchParams.get('date') ??
      new Date().toISOString().slice(0, 10),
  });
  const closeout = await getDayCloseout(hctx, date);
  return {
    ...closeout,
    meta: { disclaimer: DOCTOR_RAIL, real_food_first: REAL_FOOD_FIRST },
  };
});
