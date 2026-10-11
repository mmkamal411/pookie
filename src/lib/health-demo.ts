// Demo dataset for W22/W23. Demo mode never calls /api/v1/* — pages
// render these static rows instead. Deterministic (no Math.random) so
// server renders are stable.
import type {
  HealthReading,
  HealthSubject,
  MetricDef,
} from '@/server/services/health';
import type {
  FoodLogEntry,
  FoodSwap,
  NutritionTarget,
  WeeklyPatterns,
} from '@/server/services/nutrition';

export const DEMO_SUBJECT_DAWSON = '00000000-0000-4000-8000-00000000d221';
export const DEMO_SUBJECT_PARENT = '00000000-0000-4000-8000-00000000d222';

export function getDemoHealthSubjects(): HealthSubject[] {
  return [
    {
      id: DEMO_SUBJECT_DAWSON,
      child_id: '00000000-0000-4000-8000-0000000000d0',
      subject_kind: 'child',
      label: 'Dawson',
      notes: null,
      age_band: 'teen',
    },
    {
      id: DEMO_SUBJECT_PARENT,
      child_id: '00000000-0000-4000-8000-0000000000d0',
      subject_kind: 'household_member',
      label: 'Mehedi',
      notes: null,
      age_band: 'adult',
    },
  ];
}

export function getDemoMetricDefs(): MetricDef[] {
  return [
    { metric_key: 'steps_daily', display_name: 'Daily steps', unit: 'steps', category: 'activity', default_sensitivity: 'routine', source_types: ['manual', 'device'] },
    { metric_key: 'sleep_hours', display_name: 'Sleep', unit: 'hours', category: 'sleep', default_sensitivity: 'routine', source_types: ['manual', 'device'] },
    { metric_key: 'heart_rate_resting', display_name: 'Resting heart rate', unit: 'bpm', category: 'vitals', default_sensitivity: 'routine', source_types: ['manual', 'device'] },
    { metric_key: 'blood_glucose', display_name: 'Blood glucose', unit: 'mg/dL', category: 'glucose', default_sensitivity: 'sensitive', source_types: ['manual', 'dexcom', 'device'] },
    { metric_key: 'weight', display_name: 'Weight', unit: 'lb', category: 'growth', default_sensitivity: 'sensitive', source_types: ['manual', 'device'] },
  ];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString();
}

function reading(
  subject_id: string,
  metric_key: string,
  value_numeric: number,
  ago: number,
): HealthReading {
  return {
    id: `demo-${subject_id.slice(-4)}-${metric_key}-${ago}`,
    subject_id,
    metric_key,
    value_numeric,
    value_text: null,
    recorded_at: daysAgo(ago),
    source: 'device',
    note: null,
    created_at: daysAgo(ago),
  };
}

/** 14 days of demo readings. Weight appears ONLY for the adult subject. */
export function getDemoReadings(subjectId: string): HealthReading[] {
  const out: HealthReading[] = [];
  const steps = [2100, 3400, 5200, 4800, 6100, 2900, 7300, 5500, 4200, 6800, 3900, 5100, 5800, 4600];
  const sleep = [6.5, 7.2, 5.8, 7.8, 8.1, 6.9, 7.5, 6.2, 7.0, 8.3, 7.1, 6.7, 7.9, 7.4];
  const hr = [68, 71, 74, 69, 66, 72, 67, 70, 73, 68, 69, 71, 67, 70];
  for (let i = 0; i < 14; i++) {
    out.push(reading(subjectId, 'steps_daily', steps[i], i));
    out.push(reading(subjectId, 'sleep_hours', sleep[i], i));
    out.push(reading(subjectId, 'heart_rate_resting', hr[i], i));
  }
  if (subjectId === DEMO_SUBJECT_PARENT) {
    const weights = [248, 247.5, 247, 248.2, 246.8, 247.4, 246.5, 247, 246.2, 246.8, 246, 245.8, 246.2, 245.5];
    for (let i = 0; i < 14; i++) {
      out.push(reading(subjectId, 'weight', weights[i], i));
    }
  }
  return out.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
}

export function getDemoFoodLogs(
  subjectId: string,
  _date: string,
): FoodLogEntry[] {
  if (subjectId !== DEMO_SUBJECT_DAWSON) return [];
  const base: Omit<FoodLogEntry, 'id' | 'logged_at' | 'created_at'>[] = [
    {
      subject_id: subjectId,
      description: 'Oatmeal with berries and peanut butter',
      source: 'manual',
      calories_low: 380, calories_high: 420,
      protein_g_low: 14, protein_g_high: 16,
      carbs_g_low: 58, carbs_g_high: 64,
      fat_g_low: 12, fat_g_high: 14,
      photo_path: null,
    },
    {
      subject_id: subjectId,
      description: 'Grilled chicken sandwich and apple',
      source: 'nutritionix',
      calories_low: 520, calories_high: 560,
      protein_g_low: 38, protein_g_high: 42,
      carbs_g_low: 55, carbs_g_high: 60,
      fat_g_low: 14, fat_g_high: 16,
      photo_path: null,
    },
    {
      subject_id: subjectId,
      description: 'Plate of rice and lentils (photo estimate)',
      source: 'photo_estimate',
      calories_low: 500, calories_high: 700,
      protein_g_low: 16, protein_g_high: 24,
      carbs_g_low: 80, carbs_g_high: 105,
      fat_g_low: 8, fat_g_high: 14,
      photo_path: null,
    },
  ];
  return base.map((b, i) => ({
    ...b,
    id: `demo-food-${i}`,
    logged_at: daysAgo(0),
    created_at: daysAgo(0),
  }));
}

export function getDemoNutritionTarget(): NutritionTarget {
  return {
    id: 'demo-target-1',
    subject_id: DEMO_SUBJECT_DAWSON,
    target_kind: 'athletic_performance',
    daily_calorie_low: 2400,
    daily_calorie_high: 2800,
    protein_g_target: 120,
    carbs_g_target: 340,
    fat_g_target: 80,
    notes: 'Fuel for training days — set with the family.',
    active: true,
    created_at: daysAgo(30),
  };
}

export function getDemoWeeklyPatterns(): WeeklyPatterns {
  return {
    week_start: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
    days_logged: 6,
    entries: 17,
    avg_calories_low: 1980,
    avg_calories_high: 2260,
    avg_protein_g: 82,
    avg_carbs_g: 265,
    avg_fat_g: 68,
  };
}

export function getDemoFoodSwaps(): FoodSwap[] {
  return [
    { id: 'demo-swap-1', from_food: 'Sugary soda', to_food: 'Sparkling water with fruit', why: 'Same fizz, no added sugar', category: 'drinks' },
    { id: 'demo-swap-2', from_food: 'Candy bar', to_food: 'Apple with peanut butter', why: 'Fiber and protein keep you full longer', category: 'snacks' },
    { id: 'demo-swap-3', from_food: 'Fried chicken', to_food: 'Grilled chicken', why: 'Same protein, less breading and oil', category: 'protein' },
    { id: 'demo-swap-4', from_food: 'Sugary cereal', to_food: 'Oatmeal with berries', why: 'Whole grains hold you through the morning', category: 'breakfast' },
  ];
}

// Demo pages import everything health-related from here.
export type { FoodLogEntry };
