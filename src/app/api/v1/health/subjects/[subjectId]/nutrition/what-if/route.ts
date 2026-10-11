// POST /api/v1/health/subjects/[subjectId]/nutrition/what-if
// STUB (honest): the what-if simulator needs the Nutritionix key
// server-side (nutrition-lookup Edge Function, P2). Until then this
// returns 502 UPSTREAM_UNAVAILABLE — the API never fabricates numbers.
// Contract preserved for the next round: { query } -> { item, vs_day, alternative }.
import { handleRoute } from '@/server/rest';
import { assertHealthSubject } from '@/server/tenant';
import { whatIfFood, whatIfSchema } from '@/server/services/nutrition';

export const POST = handleRoute<{ subjectId: string }>(async (ctx, req) => {
  const hctx = await assertHealthSubject(ctx.params.subjectId);
  const body = whatIfSchema.parse(await req.json());
  // Always 502 until the food-database key lands. See services/nutrition.ts.
  return whatIfFood(hctx, body);
});
