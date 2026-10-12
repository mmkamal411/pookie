// POST /api/v1/health/ingest — device ingestion pipeline (sol-health §4.1).
//
// WINDOW-NOT-VAULT (2026-10-12): Device ingestion is DISABLED. Per the
// "window, not vault" architecture, device health data (HealthKit / Health
// Connect) is read and displayed on-device only — it is never transmitted to
// or stored by Pookie's servers. The `ingest` operation returns 410 Gone.
// Token register/revoke remain for lifecycle management of the (now vestigial)
// token records, but no readings are accepted.
//
// Ops:
//   register_token  — register/re-authorize a HealthKit / Health Connect
//                     device token. Token VALUES go to the credential vault;
//                     health_device_tokens stores lifecycle state only.
//   revoke_token    — revoke a token (stops sync).
//   ingest          — DISABLED (410 Gone). Device data stays on-device.
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

  // ---- ingest — DISABLED per Window-Not-Vault (2026-10-12) ----
  // Device health data is read and displayed on-device only. It is never
  // transmitted to Pookie's servers. This operation is permanently retired.
  if (body.op === 'ingest') {
    throw new ApiError(ErrorCodes.GONE);
  }

  // End of route — device ingestion retired per Window-Not-Vault.
});
