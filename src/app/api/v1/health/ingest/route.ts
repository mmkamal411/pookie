// POST /api/v1/health/ingest — device ingestion pipeline (sol-health §4.1).
//
// Ops:
//   register_token  — register/re-authorize a HealthKit / Health Connect
//                     device token. Token VALUES go to the credential vault;
//                     health_device_tokens stores lifecycle state only.
//   revoke_token    — revoke a token (stops sync).
//   ingest          — provenance-labeled reading ingestion.
//
// Rules enforced here (DB predicate + triggers are the backstops):
//   * <13: device sync refused (COPPA, §4.4) — steward parent logs manually.
//   * Token must be 'active'; 'suspended_pending_reauth' (18+ cutover) never resumes.
//   * metric_key allowlist; sane ranges; recorded_at = device timestamp
//     (not ingest time; not >24h future); dedupe on
//     (subject, metric, recorded_at, provenance) via pre-check.
//   * H0-class keys refused <18 (logged to access_events via auditEvent).
//   * Calorie-burn keys dropped at ingest for minor subjects (§7.1).
//   * Tier stamped from metric_defs.health_tier at write.
//   * Anomaly screen: counsel-reviewed thresholds only; on trip →
//     anomaly_flag set, teen-facing resources message returned (no
//     diagnosis, no auto-parent-alert, §4.3).
//
// Auth/cookies: delegated to handleRoute → createClient() (commit 538f288).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHealthSubject, assertTenant } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { ApiError, ErrorCodes } from '@/server/errors';
import {
  INGEST_ALLOWLIST,
  H0_REFUSED_KEYS,
  SANITY_RANGES,
  CALORIE_BURN_KEYS,
  assertNoBannedWords,
  bandFromAge,
  uuidSchema,
  toHealthApiError,
} from '../_lib';

const providerSchema = z.enum(['apple_healthkit', 'google_health_connect']);

const bodySchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('register_token'),
    subject_id: uuidSchema,
    provider: providerSchema,
    vault_token_ref: z.string().min(1).max(200),
    device_name: z.string().max(120).optional(),
  }),
  z.object({
    op: z.literal('revoke_token'),
    token_id: uuidSchema,
  }),
  z.object({
    op: z.literal('ingest'),
    subject_id: uuidSchema,
    token_id: uuidSchema,
    device_name: z.string().max(120).optional(),
    app_version: z.string().max(40).optional(),
    readings: z
      .array(
        z.object({
          metric_key: z.string().max(80),
          value_numeric: z.number().finite().optional(),
          value_text: z.string().max(200).optional(),
          recorded_at: z.string().datetime(),
        }),
      )
      .min(1)
      .max(500),
  }),
]);

const TEEN_RESOURCES_MESSAGE =
  'This reading looks unusual. Devices can be wrong — if you feel unwell, ' +
  'talk to a clinician or urgent care. 911 for emergencies, Poison Control ' +
  '1-800-222-1222, 988 for crisis support, GA Crisis & Access Line 1-800-715-4225.';

export const POST = handleRoute(async ({ requestId, userId }, req) => {
  const body = bodySchema.parse(await req.json());
  const supabase = await createClient();

  // ---- revoke_token (child-keyed row) ----
  if (body.op === 'revoke_token') {
    const { data: token, error } = await supabase
      .from('health_device_tokens')
      .select('id, child_id')
      .eq('id', body.token_id)
      .single();
    if (error || !token) throw new ApiError(ErrorCodes.NOT_FOUND);
    await assertTenant(token.child_id);
    const { error: upErr } = await supabase
      .from('health_device_tokens')
      .update({ status: 'revoked' })
      .eq('id', body.token_id);
    if (upErr) toHealthApiError(upErr, requestId);
    await auditEvent(token.child_id, 'health.device_token_revoked', {
      token_id: body.token_id,
    });
    return { revoked: true };
  }

  // ---- register_token / ingest: scope to the health subject first ----
  const subject = await assertHealthSubject(body.subject_id);
  const band = bandFromAge(subject.subjectAge);
  const childId = subject.subjectChildId!;

  if (body.op === 'register_token') {
    // §4.4: <13 → no device sync (COPPA). At 13–17 the teen's own OS consent
    // is required — a parent cannot enable sync on the teen's device.
    if (band === 'under13') {
      throw new ApiError(ErrorCodes.HEALTH_MINOR_SYNC_REFUSED);
    }
    if (subject.subjectAge !== null && subject.subjectAge < 18 && !subject.isSelf) {
      throw new ApiError(ErrorCodes.TENANT_SCOPE_VIOLATION);
    }
    try {
      const { data, error } = await supabase
        .from('health_device_tokens')
        .upsert(
          {
            child_id: childId,
            subject_id: subject.subjectRowId,
            provider: body.provider,
            status: 'active',
            device_name: body.device_name ?? null,
            vault_ref: body.vault_token_ref,
            last_sync_at: new Date().toISOString(),
          },
          { onConflict: 'child_id,provider,device_name' },
        )
        .select('id, status')
        .single();
      if (error) throw error;
      await auditEvent(childId, 'health.device_token_registered', {
        provider: body.provider,
      });
      return { token_id: data.id, status: data.status };
    } catch (err) {
      toHealthApiError(err, requestId);
    }
  }

  // ---- ingest ----
  if (band === 'under13') {
    throw new ApiError(ErrorCodes.HEALTH_MINOR_SYNC_REFUSED);
  }

  const { data: token, error: tokenErr } = await supabase
    .from('health_device_tokens')
    .select('id, status, provider, subject_id, device_name')
    .eq('id', body.token_id)
    .eq('subject_id', subject.subjectRowId)
    .single();
  if (tokenErr || !token || token.status !== 'active') {
    throw new ApiError(ErrorCodes.TENANT_SCOPE_VIOLATION);
  }
  const provenance = token.provider as 'apple_healthkit' | 'google_health_connect';

  const [{ data: defs }, { data: thresholds }] = await Promise.all([
    supabase.from('metric_defs').select('metric_key, health_tier'),
    supabase
      .from('health_alert_thresholds')
      .select('metric_key, warn_low, warn_high')
      .eq('counsel_reviewed', true),
  ]);
  const tierByKey = new Map((defs ?? []).map((d) => [d.metric_key, d.health_tier]));
  const thresholdByKey = new Map(
    (thresholds ?? []).map((t) => [t.metric_key, t]),
  );

  // Dedupe pre-check: (metric_key, recorded_at) already stored for subject.
  const since = new Date(
    Math.min(...body.readings.map((r) => new Date(r.recorded_at).getTime())),
  ).toISOString();
  const { data: existing } = await supabase
    .from('health_metrics')
    .select('metric_key, recorded_at')
    .eq('subject_id', subject.subjectRowId)
    .gte('recorded_at', since)
    .is('deleted_at', null);
  const seen = new Set(
    (existing ?? []).map((e) => `${e.metric_key}|${e.recorded_at}`),
  );

  const now = Date.now();
  const rows: Record<string, unknown>[] = [];
  const dropped: string[] = [];
  let anomalyCount = 0;

  for (const r of body.readings) {
    if (H0_REFUSED_KEYS.has(r.metric_key)) {
      if (band !== 'adult') {
        await auditEvent(childId, 'health.h0_minor_refusal', {
          metric_key: r.metric_key,
        });
        throw new ApiError(ErrorCodes.HEALTH_H0_REFUSED);
      }
      dropped.push(r.metric_key); // 18+ per-metric opt-in: not in v1
      continue;
    }
    if (CALORIE_BURN_KEYS.has(r.metric_key) && band !== 'adult') {
      dropped.push(r.metric_key); // §7.1: stripped server-side
      continue;
    }
    if (!INGEST_ALLOWLIST.has(r.metric_key)) {
      dropped.push(r.metric_key); // the app cannot receive what it cannot store
      continue;
    }
    const recordedAt = new Date(r.recorded_at).getTime();
    if (!Number.isFinite(recordedAt) || recordedAt > now + 24 * 3600 * 1000) {
      dropped.push(r.metric_key);
      continue;
    }
    const [lo, hi] = SANITY_RANGES[r.metric_key] ?? [-Infinity, Infinity];
    if (r.value_numeric === undefined && r.value_text === undefined) {
      dropped.push(r.metric_key);
      continue;
    }
    if (
      r.value_numeric !== undefined &&
      (r.value_numeric < lo || r.value_numeric > hi)
    ) {
      dropped.push(r.metric_key);
      continue;
    }
    if (seen.has(`${r.metric_key}|${r.recorded_at}`)) {
      dropped.push(`${r.metric_key}:duplicate`);
      continue;
    }

    // Anomaly screen (§4.3): counsel-reviewed thresholds only; unreviewed
    // thresholds are inert. Weight swing >10% week-over-week also flags.
    let anomaly = false;
    const th = thresholdByKey.get(r.metric_key);
    if (th && r.value_numeric !== undefined) {
      if (
        (th.warn_low !== null && r.value_numeric < th.warn_low) ||
        (th.warn_high !== null && r.value_numeric > th.warn_high)
      ) {
        anomaly = true;
      }
    }
    if (r.metric_key === 'weight' && r.value_numeric !== undefined) {
      const { data: prev } = await supabase
        .from('health_metrics')
        .select('value_numeric')
        .eq('subject_id', subject.subjectRowId)
        .eq('metric_key', 'weight')
        .is('deleted_at', null)
        .lt('recorded_at', r.recorded_at)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();
      const prevV = prev?.value_numeric as number | undefined;
      if (prevV && Math.abs(r.value_numeric - prevV) / prevV > 0.1) {
        anomaly = true;
      }
    }
    if (anomaly) anomalyCount += 1;

    rows.push({
      subject_id: subject.subjectRowId,
      metric_key: r.metric_key,
      value_numeric: r.value_numeric ?? null,
      value_text: r.value_text ?? null,
      recorded_at: r.recorded_at,
      source: 'device',
      provenance,
      device_name: body.device_name ?? token.device_name ?? null,
      app_version: body.app_version ?? null,
      health_tier: tierByKey.get(r.metric_key) ?? 'H2',
      entered_by: userId,
      anomaly_flag: anomaly,
    });
  }

  let inserted = 0;
  if (rows.length > 0) {
    try {
      const { data, error } = await supabase
        .from('health_metrics')
        .insert(rows)
        .select('id');
      if (error) throw error;
      inserted = data?.length ?? 0;
    } catch (err) {
      toHealthApiError(err, requestId);
    }
  }

  // §4.3: never auto-alert parents. On threshold trip: metadata-only event +
  // teen-facing resources message. The anomaly flag is not parent-visible.
  let teenMessage: string | null = null;
  if (anomalyCount > 0) {
    assertNoBannedWords(TEEN_RESOURCES_MESSAGE);
    teenMessage = TEEN_RESOURCES_MESSAGE;
    try {
      const { error } = await supabase.rpc('emit_wellbeing_event', {
        p_child_id: childId,
        p_event_type: 'health_anomaly_flag',
        p_severity: 'medium',
      });
      if (error) throw error;
    } catch (err) {
      toHealthApiError(err, requestId);
    }
    await auditEvent(childId, 'health.anomaly_flagged', { count: anomalyCount });
  }

  await auditEvent(childId, 'health.ingested', {
    inserted,
    dropped: dropped.length,
  });

  return {
    inserted,
    dropped,
    anomalies: anomalyCount,
    teen_message: teenMessage,
    disclaimer:
      'Pookie shows what your devices recorded. Not a medical device.',
  };
});
