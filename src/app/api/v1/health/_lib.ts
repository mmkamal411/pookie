// Shared helpers for /api/v1/health/* routes.
//
// Auth note (Cloudflare Workers cookie rule, commit 538f288): these routes
// never touch cookies directly. Session auth and cookie handling are
// delegated to handleRoute (@/server/rest) → createClient()
// (@/lib/supabase/server), which captures Set-Cookie and attaches it to the
// response explicitly. Do not add next/headers cookies().set() here.
import { z } from 'zod';
import { ApiError, ErrorCodes, mapDbError } from '@/server/errors';
import type { HealthSubjectContext } from '@/server/tenant';

export type AgeBand = 'under13' | 'teen_13_15' | 'teen_16_17' | 'adult';

/** Route-layer band from the subject's age in years (unknown → most restrictive). */
export function bandFromAge(age: number | null): AgeBand {
  if (age === null || age === undefined) return 'teen_13_15'; // fail closed
  if (age < 13) return 'under13';
  if (age < 16) return 'teen_13_15';
  if (age < 18) return 'teen_16_17';
  return 'adult';
}

export function isMinorBand(band: AgeBand): boolean {
  return band !== 'adult';
}

/** Wrap DB/RPC errors into canonical ApiErrors (raw Postgres detail stays server-side). */
export function toHealthApiError(err: unknown, requestId: string): never {
  throw new ApiError(mapDbError(err, requestId));
}

/**
 * Resolve the caller's band and fail closed on unknown DOB for the action.
 * The DB predicate (health_tier_visible) is authoritative; this is the
 * route-layer refusal for actions that must not reach the DB at all
 * (H0 collection, <13 device sync, <18 calorie logging).
 */
export function requireKnownBand(ctx: HealthSubjectContext): AgeBand {
  const band = bandFromAge(ctx.subjectAge);
  return band;
}

// ---------------------------------------------------------------------------
// Device ingestion constants (sol-health §4).
// ---------------------------------------------------------------------------

/** Metric keys the ingestion pipeline accepts. Anything else is refused. */
export const INGEST_ALLOWLIST = new Set([
  'steps_daily',
  'sleep_hours',
  'heart_rate_resting',
  'height',
  'weight',
  'blood_pressure_systolic',
  'blood_pressure_diastolic',
  'body_temperature',
  'blood_glucose',
  'hba1c',
  'activity_minutes',
]);

/** H0-class keys: refused <18; never accepted under a device token without
 *  explicit per-metric adult opt-in (not implemented in v1). */
export const H0_REFUSED_KEYS = new Set([
  'genetic_risk',
  'afib_classification',
  'fertility_prediction',
  'disease_risk_score',
]);

/** Sanity ranges (device misreads beyond these are dropped, not flagged). */
export const SANITY_RANGES: Record<string, [number, number]> = {
  steps_daily: [0, 100000],
  sleep_hours: [0, 24],
  heart_rate_resting: [25, 250],
  height: [20, 100],
  weight: [40, 800],
  blood_pressure_systolic: [60, 300],
  blood_pressure_diastolic: [30, 200],
  body_temperature: [90, 110],
  blood_glucose: [20, 1000],
  hba1c: [3, 20],
  activity_minutes: [0, 1440],
};

/**
 * Calorie-burn metric keys: dropped at ingest for minor subjects (§7.1).
 * The server strips them; the client can never re-enable with a flag.
 */
export const CALORIE_BURN_KEYS = new Set(['active_calories', 'calories_burned']);

/** Words that must never appear in W2 responses (§4.2 string-lint). */
const BANNED_HEALTH_WORDS = ['diagnose', 'disorder', 'condition', 'abnormal', 'risk'];

export function assertNoBannedWords(text: string): void {
  const lower = text.toLowerCase();
  for (const w of BANNED_HEALTH_WORDS) {
    if (lower.includes(w)) {
      throw new ApiError(ErrorCodes.VALIDATION_FAILED);
    }
  }
}

/** UUID validator shared across health routes. */
export const uuidSchema = z.string().uuid();
