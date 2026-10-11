// Pure health/nutrition formatting helpers — safe for client components.
// (The service files import next/headers via the Supabase server client,
// so client components must never import them.)
import type {
  HealthReading,
  MetricDef,
} from '@/server/services/health';

/** Latest reading per metric key (readings are recorded_at DESC). */
export function latestPerMetric(
  readings: HealthReading[],
): Map<string, HealthReading> {
  const latest = new Map<string, HealthReading>();
  for (const r of readings) {
    if (!latest.has(r.metric_key)) latest.set(r.metric_key, r);
  }
  return latest;
}

export function formatHealthValue(r: HealthReading, def?: MetricDef): string {
  const v =
    r.value_numeric != null
      ? String(Number(r.value_numeric))
      : (r.value_text ?? '—');
  return def?.unit ? `${v} ${def.unit}` : v;
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** "500–700 cal" ranges, never false point estimates. */
export function formatCalorieRange(low: number, high: number): string {
  return Number(low) === Number(high)
    ? `about ${low} cal`
    : `about ${low}–${high} cal`;
}
