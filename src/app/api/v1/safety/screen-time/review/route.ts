// /api/v1/safety/screen-time/review — parent reviews a proposed plan.
// POST { child_id, decision: 'approve' | 'counter' | 'decline', plan, reason? }
// Parent-only (assertParent).
//   approve → status 'active'            (the deal is live)
//   counter → status 'change_requested'  (parent's version in `plan`; teen's turn)
//   decline → status 'draft'            (reason required; recorded in audit)
// Review is valid from 'proposed' (and 'change_requested', which the UI also
// surfaces for the parent). Any decision supersedes an open appeal.
// All writes audited; decline/counter notes land in the audit detail.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertParent, childIdSchema } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, failWith } from '@/server/errors';
import {
  getScreenTimeRow,
  getScreenTimeState,
  screenTimePlanSchema,
} from '@/server/services/screen-time';

const reviewSchema = z.object({
  child_id: childIdSchema,
  decision: z.enum(['approve', 'counter', 'decline']),
  plan: screenTimePlanSchema,
  reason: z.string().trim().max(500).nullable().optional(),
});

export const POST = handleRoute(async (ctx, req) => {
  const body = reviewSchema.parse(await req.json());
  const tenant = await assertParent(body.child_id);
  const supabase = await createClient();

  const row = await getScreenTimeRow(supabase, tenant.childId);
  if (!row || (row.status !== 'proposed' && row.status !== 'change_requested')) {
    failWith(ErrorCodes.SCREEN_TIME_TRANSITION_INVALID);
  }

  if (body.decision === 'decline' && !body.reason) {
    // The UI promises the teen can see why — the reason is mandatory so the
    // audit record (and the future actions adapter) carries it.
    failWith(ErrorCodes.VALIDATION_FAILED);
  }

  const now = new Date().toISOString();
  // Any review decision supersedes an open appeal against the old plan.
  const clearAppeal = {
    appeal_reason: null,
    appeal_at: null,
    appeal_response: null,
    appeal_responded_at: null,
  };

  if (body.decision === 'approve') {
    const { error } = await supabase
      .from('screen_time_plans')
      .update({
        status: 'active',
        last_change_by: 'parent',
        last_change_at: now,
        ...clearAppeal,
      })
      .eq('id', row!.id);
    if (error) failWith(ErrorCodes.INTERNAL);
  } else if (body.decision === 'counter') {
    const { error } = await supabase
      .from('screen_time_plans')
      .update({
        status: 'change_requested',
        plan: body.plan,
        proposed_by: 'parent',
        last_change_by: 'parent',
        last_change_at: now,
        ...clearAppeal,
      })
      .eq('id', row!.id);
    if (error) failWith(ErrorCodes.INTERNAL);
  } else {
    const { error } = await supabase
      .from('screen_time_plans')
      .update({
        status: 'draft',
        proposed_by: null,
        last_change_by: 'parent',
        last_change_at: now,
        ...clearAppeal,
      })
      .eq('id', row!.id);
    if (error) failWith(ErrorCodes.INTERNAL);
  }

  await auditEvent(tenant.childId, 'screen_time.reviewed', {
    decision: body.decision,
    reason: body.reason ?? null,
  });
  return getScreenTimeState(supabase, tenant.childId);
});
