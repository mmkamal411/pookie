// POST /api/v1/health/reconsent — 18+ health re-consent flow (sol-health §2).
//
// Subject-only: every RPC below asserts the caller is the adult subject
// (child-role on their own child row); the route adds audit events.
//
// Ops:
//   submit_grants — write per-tier grants (H1/H2 only; H3 is unrepresentable).
//                   Body: { grants: [{ grantee_user_id: uuid, tier: 'H1'|'H2' }] }.
//                   All toggles default OFF; skip = private.
//   skip          — record the affirmative "keep everything private" choice
//                   (health_reconsent_status='skipped_private').
//   review_queue  — parent-entered rows awaiting review / correct / seal (§2.4).
//
// Auth/cookies: delegated to handleRoute → createClient() (commit 538f288).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { createClient } from '@/lib/supabase/server';
import { ApiError, ErrorCodes } from '@/server/errors';
import { uuidSchema, toHealthApiError } from '../_lib';

const grantSchema = z.object({
  grantee_user_id: uuidSchema,
  tier: z.enum(['H1', 'H2']),
});

const bodySchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('submit_grants'),
    grants: z.array(grantSchema).max(10),
  }),
  z.object({ op: z.literal('skip') }),
  z.object({ op: z.literal('review_queue') }),
]);

export const POST = handleRoute(async ({ requestId, userId }, req) => {
  const body = bodySchema.parse(await req.json());
  const supabase = await createClient();

  // Resolve the caller's own child row (subject-only flows).
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
    if (body.op === 'submit_grants') {
      const { data, error } = await supabase.rpc('rpc_health_reconsent_submit', {
        p_grants: body.grants,
      });
      if (error) throw error;
      await auditEvent(childId, 'health.reconsent_submitted', {
        grants: body.grants.length,
      });
      return data;
    }

    if (body.op === 'skip') {
      const { data, error } = await supabase.rpc('rpc_health_reconsent_skip');
      if (error) throw error;
      await auditEvent(childId, 'health.reconsent_skipped_private', {});
      return data;
    }

    const { data, error } = await supabase.rpc('rpc_health_review_queue');
    if (error) throw error;
    return { queue: data ?? [] };
  } catch (err) {
    toHealthApiError(err, requestId);
  }
});
