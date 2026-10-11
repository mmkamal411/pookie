// PATCH /api/v1/health/subjects/[subjectId]/nutrition/logs/[logId]
// DELETE — same. Subject-self only for teen-band diaries; parents of teens
// cannot edit the diary at all.
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHealthSubject } from '@/server/tenant';
import {
  deleteFoodLog,
  updateFoodLog,
  updateFoodLogSchema,
} from '@/server/services/nutrition';

export const PATCH = handleRoute<{
  subjectId: string;
  logId: string;
}>(async (ctx, req) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  const patch = updateFoodLogSchema.parse(await req.json());
  const entry = await updateFoodLog(hctx, ctx.params.logId, patch);
  await auditEvent(hctx.subjectChildId, 'food_log.updated', {
    subject_id: hctx.subjectRowId,
    log_id: entry.id,
  });
  return { entry: { id: entry.id, logged_at: entry.logged_at } };
});

export const DELETE = handleRoute<{
  subjectId: string;
  logId: string;
}>(async (ctx) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  await deleteFoodLog(hctx, ctx.params.logId);
  await auditEvent(hctx.subjectChildId, 'food_log.deleted', {
    subject_id: hctx.subjectRowId,
    log_id: ctx.params.logId,
  });
  return { deleted: true };
});
