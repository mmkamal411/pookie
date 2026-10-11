// GET /api/v1/health/subjects/[subjectId]/nutrition/patterns
// The ONLY nutrition surface for parents of teen-band subjects:
// trailing-7-day aggregates from nutrition_weekly_patterns(). No item
// detail, no descriptions, no photos — ever — in this payload.
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHealthSubject } from '@/server/tenant';
import { getWeeklyPatterns } from '@/server/services/nutrition';

export const GET = handleRoute<{ subjectId: string }>(async (ctx) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  const patterns = await getWeeklyPatterns(hctx);
  await auditEvent(hctx.subjectChildId, 'nutrition_patterns.viewed', {
    subject_id: hctx.subjectRowId,
  });
  return { patterns };
});
