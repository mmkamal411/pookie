// W22 (health tracker) + shared health primitives for W23.
// Schema: DBA canonical supabase/migrations/011_w22_health_tracker.sql.
// Every function: resolve → assert (tenant.ts) → use. Routes audit.
//
// Privacy ground rules (founder-locked):
// - All metric reads flow through RLS health_metric_visible(); routes add a
//   defense-in-depth RPC check when a single metric is requested.
// - Weight is NEVER surfaced to child-role callers (any subject) and can
//   only be logged by parents. See WEIGHT_HIDDEN_NOTE in server/health/copy.
// - Teen (13-17, unknown-DOB fail-closed) sensitive metrics: teen-self or an
//   active audited safety override — no silent parent reads.
// - Audit detail carries ids only. Health values, notes, and override
//   reasons NEVER enter audit_event (audit secret-guard).
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { failWith, ErrorCodes } from '@/server/errors';
import {
  assertHousehold,
  assertHealthSubject,
  assertParent,
  type HealthSubjectContext,
  type HouseholdContext,
} from '@/server/tenant';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AgeBand = 'under13' | 'teen' | 'adult' | 'unknown';
export type SubjectKind = 'child' | 'household_member';

export interface MetricDef {
  metric_key: string;
  display_name: string;
  unit: string | null;
  category: 'vitals' | 'growth' | 'glucose' | 'activity' | 'sleep' | 'other';
  default_sensitivity: 'routine' | 'sensitive';
  source_types: string[];
}

export interface HealthSubject {
  id: string;
  child_id: string;
  subject_kind: SubjectKind;
  label: string;
  notes: string | null;
  age_band: AgeBand;
}

export interface HealthReading {
  id: string;
  subject_id: string;
  metric_key: string;
  value_numeric: number | null;
  value_text: string | null;
  recorded_at: string;
  source: 'manual' | 'dexcom' | 'device' | 'import';
  note: string | null;
  created_at: string;
}

export interface SafetyOverride {
  id: string;
  subject_id: string;
  metric_key: string;
  reason: string;
  teen_notified_at: string;
  revoked_at: string | null;
  created_at: string;
}

/** metric_key that is never surfaced to child-role callers. */
export const WEIGHT_METRIC_KEY = 'weight';

/* ------------------------------------------------------------------ */
/* Age bands — mirrors public.health_subject_age_band() (011). Unknown */
/* DOB fails closed into the teen tier.                                */
/* ------------------------------------------------------------------ */

export function bandFromDob(dob: string | null): AgeBand {
  if (!dob) return 'unknown';
  const born = new Date(dob + 'T00:00:00Z');
  if (Number.isNaN(born.getTime())) return 'unknown';
  const now = new Date();
  const thirteenAgo = new Date(now);
  thirteenAgo.setUTCFullYear(now.getUTCFullYear() - 13);
  const eighteenAgo = new Date(now);
  eighteenAgo.setUTCFullYear(now.getUTCFullYear() - 18);
  if (born.getTime() > thirteenAgo.getTime()) return 'under13';
  if (born.getTime() > eighteenAgo.getTime()) return 'teen';
  return 'adult';
}

/** DB-authoritative band (same function the RLS predicate calls). */
export async function subjectAgeBand(
  subjectRowId: string,
): Promise<AgeBand> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('health_subject_age_band', {
    p_subject_id: subjectRowId,
  });
  if (error || !data) return 'unknown';
  const band = data as string;
  return band === 'under13' || band === 'teen' || band === 'adult'
    ? band
    : 'unknown';
}

/** True when the subject's diary-grade privacy applies (teen or unknown). */
export function isTeenPrivateBand(band: AgeBand): boolean {
  return band === 'teen' || band === 'unknown';
}

/* ------------------------------------------------------------------ */
/* Zod schemas                                                         */
/* ------------------------------------------------------------------ */

export const createSubjectSchema = z.object({
  child_id: z.string().uuid(),
  label: z.string().min(1).max(120),
  subject_kind: z.enum(['child', 'household_member']).default('child'),
  notes: z.string().max(1000).optional(),
});

export const logMetricSchema = z
  .object({
    metric_key: z.string().min(1).max(80),
    value_numeric: z.number().finite().optional(),
    value_text: z.string().min(1).max(120).optional(),
    recorded_at: z.string().datetime().optional(),
    note: z.string().max(500).optional(),
  })
  .refine((d) => d.value_numeric != null || d.value_text != null, {
    message: 'value_numeric or value_text is required',
  });

export const createOverrideSchema = z.object({
  metric_key: z.string().min(1).max(80),
  // 20-char minimum mirrors the DB CHECK — overrides are serious by schema.
  reason: z.string().trim().min(20).max(2000),
});

/* ------------------------------------------------------------------ */
/* Metric registry                                                     */
/* ------------------------------------------------------------------ */

export async function listMetricDefs(): Promise<MetricDef[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('metric_defs')
    .select('metric_key, display_name, unit, category, default_sensitivity, source_types')
    .order('category')
    .order('display_name');
  if (error) failWith(ErrorCodes.INTERNAL);
  return (data ?? []) as MetricDef[];
}

/* ------------------------------------------------------------------ */
/* Subjects                                                            */
/* ------------------------------------------------------------------ */

interface SubjectRow {
  id: string;
  child_id: string;
  subject_kind: SubjectKind;
  label: string;
  notes: string | null;
  children: { date_of_birth: string | null } | null;
}

/** Household roster. RLS scopes rows to the caller's tenant set. */
export async function listSubjects(): Promise<{
  household: HouseholdContext;
  subjects: HealthSubject[];
}> {
  const household = await assertHousehold();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('health_subjects')
    .select(
      'id, child_id, subject_kind, label, notes, children(date_of_birth)',
    )
    .order('created_at', { ascending: true });
  if (error) failWith(ErrorCodes.INTERNAL);
  const rows = (data ?? []) as unknown as SubjectRow[];
  return {
    household,
    subjects: rows.map((r) => ({
      id: r.id,
      child_id: r.child_id,
      subject_kind: r.subject_kind,
      label: r.label,
      notes: r.notes,
      age_band: bandFromDob(r.children?.date_of_birth ?? null),
    })),
  };
}

/** Parent-only: register a person in the household health roster. */
export async function createSubject(
  input: z.infer<typeof createSubjectSchema>,
): Promise<HealthSubject> {
  const parent = await assertParent(input.child_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('health_subjects')
    .insert({
      owner_user_id: parent.userId,
      child_id: parent.childId,
      subject_kind: input.subject_kind,
      label: input.label,
      notes: input.notes ?? null,
    })
    .select('id, child_id, subject_kind, label, notes')
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  const row = data as Omit<HealthSubject, 'age_band'>;
  return { ...row, age_band: await subjectAgeBand(row.id) };
}

/* ------------------------------------------------------------------ */
/* Metrics — reads flow through RLS health_metric_visible(); the route  */
/* re-checks per-metric via RPC (defense in depth). Weight is never    */
/* surfaced to child-role callers.                                     */
/* ------------------------------------------------------------------ */

export interface MetricQuery {
  metric?: string;
  from?: string;
  to?: string;
  limit?: number;
}

/**
 * Defense-in-depth visibility check for an explicitly requested metric.
 * RLS already filters; this turns "silent empty" into an explicit 403
 * (never 404 — no confirm/deny) for parent callers probing teen-private
 * metrics, per the module spec.
 */
export async function assertMetricVisible(
  hctx: HealthSubjectContext,
  metricKey: string,
): Promise<void> {
  if (hctx.role === 'child' && metricKey === WEIGHT_METRIC_KEY) {
    failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('health_metric_visible', {
    p_subject_id: hctx.subjectRowId,
    p_metric_key: metricKey,
  });
  if (error || data !== true) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
}

export async function getSubjectMetrics(
  hctx: HealthSubjectContext,
  query: MetricQuery = {},
): Promise<HealthReading[]> {
  if (query.metric) await assertMetricVisible(hctx, query.metric);
  const supabase = await createClient();
  let q = supabase
    .from('health_metrics')
    .select(
      'id, subject_id, metric_key, value_numeric, value_text, recorded_at, source, note, created_at',
    )
    .eq('subject_id', hctx.subjectRowId)
    .order('recorded_at', { ascending: false })
    .limit(Math.min(Math.max(query.limit ?? 200, 1), 1000));
  if (query.metric) q = q.eq('metric_key', query.metric);
  if (query.from) q = q.gte('recorded_at', query.from);
  if (query.to) q = q.lte('recorded_at', query.to);
  const { data, error } = await q;
  if (error) failWith(ErrorCodes.INTERNAL);
  let rows = (data ?? []) as HealthReading[];
  // Founder rule: weight never reaches teen eyes, on any subject.
  if (hctx.role === 'child') {
    rows = rows.filter((r) => r.metric_key !== WEIGHT_METRIC_KEY);
  }
  return rows;
}

/** Latest reading per metric key (for hub cards + trend headers). */
export function latestPerMetric(
  readings: HealthReading[],
): Map<string, HealthReading> {
  const latest = new Map<string, HealthReading>();
  for (const r of readings) {
    if (!latest.has(r.metric_key)) latest.set(r.metric_key, r);
  }
  return latest;
}

/** Manual entry — subject-self or parent. Teens cannot log weight. */
export async function logMetric(
  hctx: HealthSubjectContext,
  input: z.infer<typeof logMetricSchema>,
): Promise<HealthReading> {
  const defs = await listMetricDefs();
  const def = defs.find((d) => d.metric_key === input.metric_key);
  if (!def) failWith(ErrorCodes.VALIDATION_FAILED);
  if (hctx.role === 'child' && input.metric_key === WEIGHT_METRIC_KEY) {
    failWith(ErrorCodes.VALIDATION_FAILED);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('health_metrics')
    .insert({
      subject_id: hctx.subjectRowId,
      metric_key: input.metric_key,
      value_numeric: input.value_numeric ?? null,
      value_text: input.value_text ?? null,
      recorded_at: input.recorded_at ?? new Date().toISOString(),
      source: 'manual',
      entered_by: hctx.userId,
      note: input.note ?? null,
    })
    .select(
      'id, subject_id, metric_key, value_numeric, value_text, recorded_at, source, note, created_at',
    )
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  return data as HealthReading;
}

/* ------------------------------------------------------------------ */
/* Safety overrides — parent-only, audited, teen notified.             */
/* 011 has no notifications table: the route records teen_notified_at  */
/* in-transaction (proof of disclosure) and the parent UI discloses     */
/* scope + reason. A teen-facing notification surface is P2.            */
/* ------------------------------------------------------------------ */

/** Overrides only exist where sensitive-default-private applies. */
async function assertOverrideApplies(
  hctx: HealthSubjectContext,
  metricKey: string,
): Promise<void> {
  const defs = await listMetricDefs();
  const def = defs.find((d) => d.metric_key === metricKey);
  if (!def || def.default_sensitivity !== 'sensitive') {
    failWith(ErrorCodes.VALIDATION_FAILED);
  }
  const band = await subjectAgeBand(hctx.subjectRowId);
  if (!isTeenPrivateBand(band)) failWith(ErrorCodes.VALIDATION_FAILED);
}

export async function listOverrides(
  hctx: HealthSubjectContext,
): Promise<SafetyOverride[]> {
  await assertParent(hctx.subjectChildId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('health_safety_overrides')
    .select(
      'id, subject_id, metric_key, reason, teen_notified_at, revoked_at, created_at',
    )
    .eq('subject_id', hctx.subjectRowId)
    .order('created_at', { ascending: false });
  if (error) failWith(ErrorCodes.INTERNAL);
  return (data ?? []) as SafetyOverride[];
}

export async function createOverride(
  hctx: HealthSubjectContext,
  input: z.infer<typeof createOverrideSchema>,
): Promise<SafetyOverride> {
  const parent = await assertParent(hctx.subjectChildId);
  await assertOverrideApplies(hctx, input.metric_key);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('health_safety_overrides')
    .insert({
      subject_id: hctx.subjectRowId,
      metric_key: input.metric_key,
      parent_user_id: parent.userId,
      reason: input.reason,
      teen_notified_at: new Date().toISOString(),
    })
    .select(
      'id, subject_id, metric_key, reason, teen_notified_at, revoked_at, created_at',
    )
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  return data as SafetyOverride;
}

export async function revokeOverride(
  hctx: HealthSubjectContext,
  overrideId: string,
): Promise<SafetyOverride> {
  await assertParent(hctx.subjectChildId);
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('health_safety_overrides')
    .select('id')
    .eq('id', overrideId)
    .eq('subject_id', hctx.subjectRowId)
    .maybeSingle();
  if (!existing) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  const { data, error } = await supabase
    .from('health_safety_overrides')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', overrideId)
    .select(
      'id, subject_id, metric_key, reason, teen_notified_at, revoked_at, created_at',
    )
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  return data as SafetyOverride;
}
