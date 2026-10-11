// GET /api/v1/health/subjects/[subjectId]/nutrition/day?date=YYYY-MM-DD
// The day's totals vs the active target — diary holders only
// (parents of teen-band subjects use /patterns).
import { z } from 'zod';
import { handleRoute } from '@/server/rest';
import { assertHealthSubject } from '@/server/tenant';
import { DOCTOR_RAIL } from '@/server/health/copy';
import { getDaySummary } from '@/server/services/nutrition';

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
  const summary = await getDaySummary(hctx, date);
  return { ...summary, meta: { disclaimer: DOCTOR_RAIL } };
});
