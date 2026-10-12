// POST /api/v1/health/records — review–correct–seal + deletion pipeline.
//
// Subject-only (the RPCs enforce caller-is-subject; the route adds audit).
// All tiers, including H3: the teen owns correction and deletion.
//
// Ops:
//   correct          — inline correction of a parent-entered row (§2.4).
//                      Body: { table, record_id, patch } — patch keys are
//                      allow-listed server-side; every correction writes a
//                      health_corrections row (old/new/corrected_by/at).
//   delete           — tombstone a record now (H3 → hard delete on the next
//                      nightly run; H1/H2 → ≤30 days) (§3.3).
//   hide_past        — "Hide my past health data too": instantly deletes all
//                      health_grace rows for the caller (all viewers, all
//                      tiers). The revoked viewer sees a neutral
//                      "Health sharing ended" — never what was hidden (§3.2).
//   request_deletion — scoped deletion request (§3.3).
//                      Body: { scope } where scope is one of:
//                        'tier:H2' | 'tier:H3' | 'category:wellbeing' |
//                        'record:<uuid>' | 'all_health'.
//                      Immediate tombstone; hard delete ≤30 days (H3: next
//                      nightly run); backups purged ≤30 days after source.
//
// Auth/cookies: delegated to handleRoute → createClient() (commit 538f288).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { createClient } from '@/lib/supabase/server';
import { ApiError, ErrorCodes } from '@/server/errors';
import { uuidSchema, toHealthApiError } from '../_lib';

const correctableTable = z.enum([
  'health_metrics',
  'food_logs',
  'allergy_list',
  'health_medications',
  'wellbeing_entries',
]);

const deletionScope = z.union([
  z.enum(['tier:H2', 'tier:H3', 'category:wellbeing', 'all_health']),
  z.string().regex(/^record:[0-9a-f-]{36}$/i),
]);

const bodySchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('correct'),
    table: correctableTable,
    record_id: uuidSchema,
    patch: z.record(z.string(), z.unknown()).refine(
      (p) => Object.keys(p).length > 0 && Object.keys(p).length <= 10,
      'patch must name 1–10 fields',
    ),
  }),
  z.object({
    op: z.literal('delete'),
    table: correctableTable,
    record_id: uuidSchema,
  }),
  z.object({ op: z.literal('hide_past') }),
  z.object({
    op: z.literal('request_deletion'),
    scope: deletionScope,
  }),
]);

export const POST = handleRoute(async ({ requestId, userId }, req) => {
  const body = bodySchema.parse(await req.json());
  const supabase = await createClient();

  const { data: me } = await supabase
    .from('child_access')
    .select('child_id')
    .eq('user_id', userId)
    .eq('role', 'child')
    .limit(1)
    .maybeSingle();
  const childId = me?.child_id as string | undefined;
  if (!childId) {
    throw new ApiError(ErrorCodes.HEALTH_TEEN_ONLY);
  }

  try {
    switch (body.op) {
      case 'correct': {
        const { data, error } = await supabase.rpc(
          'rpc_health_record_correct',
          {
            p_table: body.table,
            p_record_id: body.record_id,
            p_patch: body.patch,
          },
        );
        if (error) throw error;
        await auditEvent(childId, 'health.record_corrected', {
          table: body.table,
        });
        return data;
      }
      case 'delete': {
        const { data, error } = await supabase.rpc('rpc_health_record_delete', {
          p_table: body.table,
          p_record_id: body.record_id,
        });
        if (error) throw error;
        await auditEvent(childId, 'health.record_deleted', {
          table: body.table,
        });
        return data;
      }
      case 'hide_past': {
        const { data, error } = await supabase.rpc('rpc_hide_past_health');
        if (error) throw error;
        await auditEvent(childId, 'health.hide_past', {});
        return data;
      }
      case 'request_deletion': {
        const { data, error } = await supabase.rpc(
          'rpc_request_health_deletion',
          { p_scope: { scope: body.scope } },
        );
        if (error) throw error;
        await auditEvent(childId, 'health.deletion_requested', {
          scope: body.scope,
        });
        return data;
      }
    }
  } catch (err) {
    toHealthApiError(err, requestId);
  }
});
