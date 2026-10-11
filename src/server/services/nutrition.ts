// W23 (nutrition tracker) service layer.
// Schema: DBA canonical supabase/migrations/012_w23_nutrition.sql.
//
// The diary contract (the core W23 privacy split):
// - food_logs is the subject's DIARY. For teen/unknown-band 'child'
//   subjects, parents get ZERO rows — their only window is the
//   aggregates-only nutrition_weekly_patterns() RPC.
// - Photo estimates MUST carry a true calorie range (low < high); the route
//   refuses false precision before the DB is reached.
// - nutrition_targets.target_kind has no deficit kind — under-18 weight-loss
//   mode is unrepresentable by schema, enforced again in Zod.
// - Audit detail carries ids only — never food descriptions or values.
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { failWith, ErrorCodes } from '@/server/errors';
import {
  assertParent,
  type HealthSubjectContext,
} from '@/server/tenant';
import {
  isTeenPrivateBand,
  subjectAgeBand,
  type AgeBand,
} from './health';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type FoodLogSource =
  | 'manual'
  | 'photo_estimate'
  | 'nutritionix'
  | 'usda'
  | 'openfoodfacts'
  | 'barcode';

export interface FoodLogEntry {
  id: string;
  subject_id: string;
  logged_at: string;
  description: string;
  source: FoodLogSource;
  calories_low: number;
  calories_high: number;
  protein_g_low: number | null;
  protein_g_high: number | null;
  carbs_g_low: number | null;
  carbs_g_high: number | null;
  fat_g_low: number | null;
  fat_g_high: number | null;
  photo_path: string | null;
  created_at: string;
}

export type NutritionTargetKind =
  | 'maintain'
  | 'athletic_performance'
  | 'healthy_gain'
  | 'medical_recovery';

export interface NutritionTarget {
  id: string;
  subject_id: string;
  target_kind: NutritionTargetKind;
  daily_calorie_low: number | null;
  daily_calorie_high: number | null;
  protein_g_target: number | null;
  carbs_g_target: number | null;
  fat_g_target: number | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

export interface FoodSwap {
  id: string;
  from_food: string;
  to_food: string;
  why: string;
  category: string;
}

export interface WeeklyPatterns {
  week_start: string;
  days_logged: number;
  entries: number;
  avg_calories_low: number | null;
  avg_calories_high: number | null;
  avg_protein_g: number | null;
  avg_carbs_g: number | null;
  avg_fat_g: number | null;
}

export interface DayTotals {
  calories_low: number;
  calories_high: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  entries: number;
  estimated_entries: number;
}

export interface DaySummary {
  date: string;
  totals: DayTotals;
  target: NutritionTarget | null;
}

export interface NutrientGap {
  nutrient: 'protein' | 'calories';
  short_by: number;
  unit: string;
  swaps: FoodSwap[];
}

export interface DayCloseout extends DaySummary {
  gaps: NutrientGap[];
  tomorrow_note: string;
}

/* ------------------------------------------------------------------ */
/* Zod schemas                                                         */
/* ------------------------------------------------------------------ */

const FOOD_SOURCES = [
  'manual',
  'photo_estimate',
  'nutritionix',
  'usda',
  'openfoodfacts',
  'barcode',
] as const;

const macroPair = (lowKey: string, highKey: string) =>
  z
    .object({
      [lowKey]: z.number().nonnegative().optional(),
      [highKey]: z.number().nonnegative().optional(),
    })
    .refine(
      (d) =>
        (d[lowKey] == null && d[highKey] == null) ||
        (d[lowKey] != null &&
          d[highKey] != null &&
          (d[highKey] as number) >= (d[lowKey] as number)),
      { message: `${lowKey}/${highKey} must both be set with high >= low` },
    );

export const logFoodSchema = z
  .object({
    description: z.string().trim().min(1).max(500),
    logged_at: z.string().datetime().optional(),
    source: z.enum(FOOD_SOURCES).default('manual'),
    calories_low: z.number().nonnegative(),
    calories_high: z.number().nonnegative(),
    photo_path: z.string().max(500).optional(),
  })
  .and(macroPair('protein_g_low', 'protein_g_high'))
  .and(macroPair('carbs_g_low', 'carbs_g_high'))
  .and(macroPair('fat_g_low', 'fat_g_high'))
  .refine((d) => d.calories_high >= d.calories_low, {
    message: 'calories_high must be >= calories_low',
  })
  .refine(
    (d) => d.source !== 'photo_estimate' || d.calories_low < d.calories_high,
    {
      // Photo estimates are ranges, never points — false precision refused.
      message: 'photo_estimate requires a true range (calories_low < calories_high)',
    },
  );

export const updateFoodLogSchema = z
  .object({
    description: z.string().trim().min(1).max(500).optional(),
    logged_at: z.string().datetime().optional(),
    source: z.enum(FOOD_SOURCES).optional(),
    calories_low: z.number().nonnegative().optional(),
    calories_high: z.number().nonnegative().optional(),
    protein_g_low: z.number().nonnegative().optional(),
    protein_g_high: z.number().nonnegative().optional(),
    carbs_g_low: z.number().nonnegative().optional(),
    carbs_g_high: z.number().nonnegative().optional(),
    fat_g_low: z.number().nonnegative().optional(),
    fat_g_high: z.number().nonnegative().optional(),
    photo_path: z.string().max(500).optional(),
  })
  .refine(
    (d) =>
      d.calories_low == null ||
      d.calories_high == null ||
      d.calories_high >= d.calories_low,
    { message: 'calories_high must be >= calories_low' },
  )
  .refine(
    (d) =>
      (d.protein_g_low == null && d.protein_g_high == null) ||
      (d.protein_g_low != null &&
        d.protein_g_high != null &&
        d.protein_g_high >= d.protein_g_low),
    { message: 'protein_g_low/protein_g_high must both be set with high >= low' },
  )
  .refine(
    (d) =>
      (d.carbs_g_low == null && d.carbs_g_high == null) ||
      (d.carbs_g_low != null &&
        d.carbs_g_high != null &&
        d.carbs_g_high >= d.carbs_g_low),
    { message: 'carbs_g_low/carbs_g_high must both be set with high >= low' },
  )
  .refine(
    (d) =>
      (d.fat_g_low == null && d.fat_g_high == null) ||
      (d.fat_g_low != null &&
        d.fat_g_high != null &&
        d.fat_g_high >= d.fat_g_low),
    { message: 'fat_g_low/fat_g_high must both be set with high >= low' },
  );

export const setTargetsSchema = z.object({
  // No deficit kind exists — under-18 weight-loss mode is unrepresentable.
  target_kind: z.enum([
    'maintain',
    'athletic_performance',
    'healthy_gain',
    'medical_recovery',
  ]),
  daily_calorie_low: z.number().nonnegative().optional(),
  daily_calorie_high: z.number().nonnegative().optional(),
  protein_g_target: z.number().nonnegative().optional(),
  carbs_g_target: z.number().nonnegative().optional(),
  fat_g_target: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
}).refine(
  (d) =>
    d.daily_calorie_low == null ||
    d.daily_calorie_high == null ||
    d.daily_calorie_high >= d.daily_calorie_low,
  { message: 'daily_calorie_high must be >= daily_calorie_low' },
);

export const whatIfSchema = z.object({
  query: z.string().trim().min(2).max(200),
});

/* ------------------------------------------------------------------ */
/* Diary privacy — parents of teen-band subjects get 403 (never a      */
/* silent empty diary). Under-13/adult/household_member: tenant rules. */
/* ------------------------------------------------------------------ */

export async function assertDiaryAccess(
  hctx: HealthSubjectContext,
): Promise<AgeBand> {
  const band = await subjectAgeBand(hctx.subjectRowId);
  if (
    hctx.subjectKind === 'child' &&
    isTeenPrivateBand(band) &&
    hctx.role !== 'child'
  ) {
    failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  }
  return band;
}

/** Teen diary writes: the teen themselves, or a parent of under-13/adult. */
export async function assertDiaryWrite(
  hctx: HealthSubjectContext,
): Promise<AgeBand> {
  const band = await subjectAgeBand(hctx.subjectRowId);
  if (hctx.subjectKind === 'child' && isTeenPrivateBand(band)) {
    if (!hctx.isSelf) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  }
  return band;
}

const FOOD_LOG_COLUMNS =
  'id, subject_id, logged_at, description, source, calories_low, calories_high, protein_g_low, protein_g_high, carbs_g_low, carbs_g_high, fat_g_low, fat_g_high, photo_path, created_at';

/* ------------------------------------------------------------------ */
/* Food logs                                                           */
/* ------------------------------------------------------------------ */

export async function getFoodLogs(
  hctx: HealthSubjectContext,
  date?: string,
): Promise<FoodLogEntry[]> {
  await assertDiaryAccess(hctx);
  const supabase = await createClient();
  let q = supabase
    .from('food_logs')
    .select(FOOD_LOG_COLUMNS)
    .eq('subject_id', hctx.subjectRowId)
    .order('logged_at', { ascending: false })
    .limit(200);
  if (date) {
    const start = new Date(`${date}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    q = supabase
      .from('food_logs')
      .select(FOOD_LOG_COLUMNS)
      .eq('subject_id', hctx.subjectRowId)
      .gte('logged_at', start.toISOString())
      .lt('logged_at', end.toISOString())
      .order('logged_at', { ascending: false });
  }
  const { data, error } = await q;
  if (error) failWith(ErrorCodes.INTERNAL);
  return (data ?? []) as FoodLogEntry[];
}

export async function logFood(
  hctx: HealthSubjectContext,
  input: z.infer<typeof logFoodSchema>,
): Promise<FoodLogEntry> {
  await assertDiaryWrite(hctx);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('food_logs')
    .insert({
      subject_id: hctx.subjectRowId,
      logged_at: input.logged_at ?? new Date().toISOString(),
      description: input.description,
      source: input.source,
      calories_low: input.calories_low,
      calories_high: input.calories_high,
      protein_g_low: input.protein_g_low ?? null,
      protein_g_high: input.protein_g_high ?? null,
      carbs_g_low: input.carbs_g_low ?? null,
      carbs_g_high: input.carbs_g_high ?? null,
      fat_g_low: input.fat_g_low ?? null,
      fat_g_high: input.fat_g_high ?? null,
      photo_path: input.photo_path ?? null,
      logged_by: hctx.userId,
    })
    .select(FOOD_LOG_COLUMNS)
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  return data as FoodLogEntry;
}

async function getOwnLog(
  hctx: HealthSubjectContext,
  logId: string,
): Promise<FoodLogEntry> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('food_logs')
    .select(FOOD_LOG_COLUMNS)
    .eq('id', logId)
    .eq('subject_id', hctx.subjectRowId)
    .maybeSingle();
  if (!data) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  return data as FoodLogEntry;
}

export async function updateFoodLog(
  hctx: HealthSubjectContext,
  logId: string,
  patch: z.infer<typeof updateFoodLogSchema>,
): Promise<FoodLogEntry> {
  await assertDiaryWrite(hctx);
  await getOwnLog(hctx, logId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('food_logs')
    .update({ ...patch })
    .eq('id', logId)
    .select(FOOD_LOG_COLUMNS)
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  return data as FoodLogEntry;
}

export async function deleteFoodLog(
  hctx: HealthSubjectContext,
  logId: string,
): Promise<void> {
  await assertDiaryWrite(hctx);
  await getOwnLog(hctx, logId);
  const supabase = await createClient();
  const { error } = await supabase.from('food_logs').delete().eq('id', logId);
  if (error) failWith(ErrorCodes.INTERNAL);
}

/* ------------------------------------------------------------------ */
/* Nutrition targets — parent-set, tenant-readable. No deficit kind.   */
/* ------------------------------------------------------------------ */

const TARGET_COLUMNS =
  'id, subject_id, target_kind, daily_calorie_low, daily_calorie_high, protein_g_target, carbs_g_target, fat_g_target, notes, active, created_at';

export async function getNutritionTargets(
  hctx: HealthSubjectContext,
): Promise<NutritionTarget | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('nutrition_targets')
    .select(TARGET_COLUMNS)
    .eq('subject_id', hctx.subjectRowId)
    .eq('active', true)
    .maybeSingle();
  if (error) failWith(ErrorCodes.INTERNAL);
  return (data as NutritionTarget | null) ?? null;
}

/** Parent-only. Supersedes the current active target (append-only). */
export async function setNutritionTargets(
  hctx: HealthSubjectContext,
  input: z.infer<typeof setTargetsSchema>,
): Promise<NutritionTarget> {
  const parent = await assertParent(hctx.subjectChildId);
  const supabase = await createClient();
  await supabase
    .from('nutrition_targets')
    .update({ active: false })
    .eq('subject_id', hctx.subjectRowId)
    .eq('active', true);
  const { data, error } = await supabase
    .from('nutrition_targets')
    .insert({
      subject_id: hctx.subjectRowId,
      target_kind: input.target_kind,
      daily_calorie_low: input.daily_calorie_low ?? null,
      daily_calorie_high: input.daily_calorie_high ?? null,
      protein_g_target: input.protein_g_target ?? null,
      carbs_g_target: input.carbs_g_target ?? null,
      fat_g_target: input.fat_g_target ?? null,
      notes: input.notes ?? null,
      set_by: parent.userId,
      active: true,
    })
    .select(TARGET_COLUMNS)
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  return data as NutritionTarget;
}

/* ------------------------------------------------------------------ */
/* Weekly patterns — the ONLY nutrition surface for parents of teens.  */
/* Aggregates only; the RPC enforces parent-or-self.                   */
/* ------------------------------------------------------------------ */

export async function getWeeklyPatterns(
  hctx: HealthSubjectContext,
): Promise<WeeklyPatterns> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('nutrition_weekly_patterns', {
    p_subject_id: hctx.subjectRowId,
  });
  if (error) {
    const message = error.message ?? '';
    if (/denied/i.test(message)) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
    failWith(ErrorCodes.INTERNAL);
  }
  return data as WeeklyPatterns;
}

/* ------------------------------------------------------------------ */
/* Day summary + gentle closeout (diary holders only).                 */
/* ------------------------------------------------------------------ */

function midpoint(low: number | null, high: number | null): number | null {
  if (low == null || high == null) return null;
  return (low + high) / 2;
}

export async function getDaySummary(
  hctx: HealthSubjectContext,
  date: string,
): Promise<DaySummary> {
  const entries = await getFoodLogs(hctx, date);
  const totals: DayTotals = {
    calories_low: 0,
    calories_high: 0,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    entries: entries.length,
    estimated_entries: entries.filter((e) => e.source === 'photo_estimate')
      .length,
  };
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let proteinN = 0;
  let carbsN = 0;
  let fatN = 0;
  for (const e of entries) {
    totals.calories_low += Number(e.calories_low);
    totals.calories_high += Number(e.calories_high);
    const p = midpoint(
      e.protein_g_low == null ? null : Number(e.protein_g_low),
      e.protein_g_high == null ? null : Number(e.protein_g_high),
    );
    const c = midpoint(
      e.carbs_g_low == null ? null : Number(e.carbs_g_low),
      e.carbs_g_high == null ? null : Number(e.carbs_g_high),
    );
    const f = midpoint(
      e.fat_g_low == null ? null : Number(e.fat_g_low),
      e.fat_g_high == null ? null : Number(e.fat_g_high),
    );
    if (p != null) {
      protein += p;
      proteinN += 1;
    }
    if (c != null) {
      carbs += c;
      carbsN += 1;
    }
    if (f != null) {
      fat += f;
      fatN += 1;
    }
  }
  totals.protein_g = proteinN > 0 ? Math.round(protein * 10) / 10 : null;
  totals.carbs_g = carbsN > 0 ? Math.round(carbs * 10) / 10 : null;
  totals.fat_g = fatN > 0 ? Math.round(fat * 10) / 10 : null;
  const target = await getNutritionTargets(hctx);
  return { date, totals, target };
}

export async function listFoodSwaps(): Promise<FoodSwap[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('food_swaps')
    .select('id, from_food, to_food, why, category')
    .order('category')
    .order('from_food');
  if (error) failWith(ErrorCodes.INTERNAL);
  return (data ?? []) as FoodSwap[];
}

/**
 * The gentle daily closeout — gaps cite real whole foods first
 * (real-food-first as data), never supplements, never shame.
 * Only "short" gaps are computed: nourishment framing, never restriction.
 */
export async function getDayCloseout(
  hctx: HealthSubjectContext,
  date: string,
): Promise<DayCloseout> {
  const summary = await getDaySummary(hctx, date);
  const swaps = await listFoodSwaps();
  const gaps: NutrientGap[] = [];
  const { totals, target } = summary;

  if (target?.protein_g_target != null && totals.protein_g != null) {
    const shortBy = Math.round(target.protein_g_target - totals.protein_g);
    if (shortBy > 0) {
      gaps.push({
        nutrient: 'protein',
        short_by: shortBy,
        unit: 'g',
        swaps: swaps.filter((s) => s.category === 'protein').slice(0, 2),
      });
    }
  }
  if (target?.daily_calorie_low != null) {
    const shortBy = Math.round(target.daily_calorie_low - totals.calories_high);
    if (shortBy > 0) {
      gaps.push({
        nutrient: 'calories',
        short_by: shortBy,
        unit: 'cal',
        swaps: swaps
          .filter((s) => s.category === 'breakfast' || s.category === 'snacks')
          .slice(0, 2),
      });
    }
  }

  const tomorrow_note =
    gaps.length === 0
      ? 'A steady day. Tomorrow looks after itself — just keep eating real food.'
      : `One gentle nudge for tomorrow: ${gaps
          .map((g) =>
            g.nutrient === 'protein'
              ? `about ${g.short_by}g more protein`
              : 'a little more fuel earlier in the day',
          )
          .join(' and ')}. ${gaps[0].swaps[0] ? `Try ${gaps[0].swaps[0].to_food.toLowerCase()} — ${gaps[0].swaps[0].why.toLowerCase()}.` : ''}`;

  return { ...summary, gaps, tomorrow_note };
}

/* ------------------------------------------------------------------ */
/* What-if simulator — STUB. The honest path needs the Nutritionix key */
/* server-side (nutrition-lookup Edge Function, P2). Until then the     */
/* route returns 502 UPSTREAM_UNAVAILABLE — never fabricated numbers.  */
/* ------------------------------------------------------------------ */

export async function whatIfFood(
  _hctx: HealthSubjectContext,
  _input: z.infer<typeof whatIfSchema>,
): Promise<never> {
  failWith(ErrorCodes.UPSTREAM_UNAVAILABLE);
}
