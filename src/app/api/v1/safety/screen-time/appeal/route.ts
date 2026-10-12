// /api/v1/safety/screen-time/appeal — teen appeals an active plan.
// GET  ?child_id=<uuid> — the open appeal as a list (supports the UI's
//        listScreenTimeAppeals contract; 0 or 1 entries — one open slot).
// POST { child_id, action: 'file', reason }
//        — teen-only; files an appeal against an ACTIVE plan.
// POST { child_id, action: 'respond', decision: 'approve' | 'deny', response }
//        — parent-only; approve → status 'change_requested' (invites a new
//        proposal), deny → stays 'active'. All writes audited.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertParent, assertTenant, childIdSchema } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, failWith } from '@/server/errors';
import {
  currentAppealAsList,
  getScreenTimeRow,
  getScreenTimeState,
} from '@/server/services/screen-time';

export const GET = handleRoute(async (ctx, req) => {
  const childId = childIdSchema.parse(
    req.nextUrl.searchParams.get('child_id'),
  );
  const tenant = await assertTenant(childId);
  const supabase = await createClient();
  const row = await getScreenTimeRow(supabase, tenant.childId);
  return { appeals: currentAppealAsList(row) };
});

const appealSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('file'),
    child_id: childIdSchema,
    reason: z.string().trim().min(1).max(1000),
  }),
  z.object({
    action: z.literal('respond'),
    child_id: childIdSchema,
    decision: z.enum(['approve', 'deny']),
    response: z.string().trim().min(1).max(1000),
  }),
]);

export const POST = handleRoute(async (ctx, req) => {
  const body = appealSchema.parse(await req.json());
  const supabase = await createClient();

  if (body.action === 'file') {
    const tenant = await assertTenant(body.child_id);
    if (tenant.role !== 'child') failWith(ErrorCodes.CHILD_ROLE_REQUIRED);

    const row = await getScreenTimeRow(supabase, tenant.childId);
    if (!row || row.status !== 'active') {
      // Appeals are only meaningful against the live, agreed plan.
      failWith(ErrorCodes.SCREEN_TIME_TRANSITION_INVALID);
    }
    if (row.appeal_reason && !row.appeal_response) {
      failWith(ErrorCodes.SCREEN_TIME_TRANSITION_INVALID);
    }

    const { error } = await supabase
      .from('screen_time_plans')
      .update({
        appeal_reason: body.reason,
        appeal_at: new Date().toISOString(),
        appeal_response: null,
        appeal_responded_at: null,
      })
      .eq('id', row.id);
    if (error) failWith(ErrorCodes.INTERNAL);

    await auditEvent(tenant.childId, 'screen_time.appeal_filed');
    return getScreenTimeState(supabase, tenant.childId);
  }

  // action === 'respond' — parent only.
  const tenant = await assertParent(body.child_id);
  const row = await getScreenTimeRow(supabase, tenant.childId);
  if (!row || !row.appeal_reason || row.appeal_response) {
    failWith(ErrorCodes.SCREEN_TIME_TRANSITION_INVALID);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('screen_time_plans')
    .update({
      appeal_response: body.response,
      appeal_responded_at: now,
      last_change_by: 'parent',
      last_change_at: now,
      // Approving the appeal reopens negotiation: teen's turn to propose.
      ...(body.decision === 'approve' ? { status: 'change_requested' } : {}),
    })
    .eq('id', row.id);
  if (error) failWith(ErrorCodes.INTERNAL);

  await auditEvent(tenant.childId, 'screen_time.appeal_responded', {
    decision: body.decision,
  });
  return getScreenTimeState(supabase, tenant.childId);
});
