// GET /api/v1/health/subjects/[subjectId]/nutrition/targets — tenant read.
// PUT — parent-only set. target_kind has no deficit kind: under-18
// weight-loss mode is unrepresentable (schema CHECK + Zod enum).
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHealthSubject } from '@/server/tenant';
import { TARGET_KIND_COPY } from '@/server/health/copy';
import {
  getNutritionTargets,
  setNutritionTargets,
  setTargetsSchema,
} from '@/server/services/nutrition';

export const GET = handleRoute<{ subjectId: string }>(async (ctx) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  const target = await getNutritionTargets(hctx);
  return {
    target: target
      ? {
          id: target.id,
          target_kind: target.target_kind,
          target_kind_copy:
            TARGET_KIND_COPY[target.target_kind] ?? target.target_kind,
          daily_calorie_low: target.daily_calorie_low,
          daily_calorie_high: target.daily_calorie_high,
          protein_g_target: target.protein_g_target,
          carbs_g_target: target.carbs_g_target,
          fat_g_target: target.fat_g_target,
          notes: target.notes,
        }
      : null,
  };
});

export const PUT = handleRoute<{ subjectId: string }>(async (ctx, req) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  const body = setTargetsSchema.parse(await req.json());
  const target = await setNutritionTargets(hctx, body);
  await auditEvent(hctx.subjectChildId, 'nutrition_target.updated', {
    subject_id: hctx.subjectRowId,
    target_id: target.id,
    target_kind: target.target_kind,
  });
  return {
    target: {
      id: target.id,
      target_kind: target.target_kind,
      daily_calorie_low: target.daily_calorie_low,
      daily_calorie_high: target.daily_calorie_high,
      protein_g_target: target.protein_g_target,
      carbs_g_target: target.carbs_g_target,
      fat_g_target: target.fat_g_target,
    },
  };
});
