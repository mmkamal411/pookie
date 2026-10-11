// GET /api/v1/health/subjects/[subjectId]/nutrition/logs — the diary.
// POST — log a meal. Parents of teen-band subjects get 403 (never a silent
// empty diary); photo_estimate requires a true calorie range.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHealthSubject } from '@/server/tenant';
import { DOCTOR_RAIL } from '@/server/health/copy';
import {
  getFoodLogs,
  logFood,
  logFoodSchema,
  type FoodLogEntry,
} from '@/server/services/nutrition';

const dateQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
});

function shape(e: FoodLogEntry) {
  return {
    id: e.id,
    logged_at: e.logged_at,
    description: e.description,
    source: e.source,
    calories_low: e.calories_low,
    calories_high: e.calories_high,
    protein_g_low: e.protein_g_low,
    protein_g_high: e.protein_g_high,
    carbs_g_low: e.carbs_g_low,
    carbs_g_high: e.carbs_g_high,
    fat_g_low: e.fat_g_low,
    fat_g_high: e.fat_g_high,
    // Ranges render as ranges in the UI — never a point estimate.
    calories_label:
      Number(e.calories_low) === Number(e.calories_high)
        ? `about ${e.calories_low} cal`
        : `about ${e.calories_low}–${e.calories_high} cal`,
  };
}

export const GET = handleRoute<{ subjectId: string }>(async (ctx, req) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  const url = new URL(req.url);
  const { date } = dateQuery.parse({
    date: url.searchParams.get('date') ?? undefined,
  });
  const entries = await getFoodLogs(hctx, date);
  return {
    entries: entries.map(shape),
    meta: { disclaimer: DOCTOR_RAIL },
  };
});

export const POST = handleRoute<{ subjectId: string }>(async (ctx, req) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  const body = logFoodSchema.parse(await req.json());
  const entry = await logFood(hctx, body);
  await auditEvent(hctx.subjectChildId, 'food_log.created', {
    subject_id: hctx.subjectRowId,
    log_id: entry.id,
  });
  return {
    entry: shape(entry),
    meta: { disclaimer: DOCTOR_RAIL },
  };
});
