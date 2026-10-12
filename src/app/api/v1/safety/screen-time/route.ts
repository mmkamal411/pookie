// /api/v1/safety/screen-time — W15 Screen Time co-set.
// GET  ?child_id=<uuid> — current ScreenTimeState for the child (draft + empty
//        plan when no row exists yet).
// POST { child_id, op: 'propose', plan } — teen or parent proposes a plan
//        (status → proposed). Teen proposes, parent approves — never the
//        reverse for initial setup: a parent may NOT propose from 'draft'.
//        A parent CAN propose changes once a plan exists (active /
//        change_requested). All writes audited.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertTenant, childIdSchema } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, failWith } from '@/server/errors';
import {
  getScreenTimeRow,
  getScreenTimeState,
  resolveScreenTimeOwner,
  screenTimePlanSchema,
} from '@/server/services/screen-time';

export const GET = handleRoute(async (ctx, req) => {
  const childId = childIdSchema.parse(
    req.nextUrl.searchParams.get('child_id'),
  );
  const tenant = await assertTenant(childId);
  const supabase = await createClient();
  return getScreenTimeState(supabase, tenant.childId);
});

const proposeSchema = z.object({
  child_id: childIdSchema,
  op: z.literal('propose'),
  plan: screenTimePlanSchema,
});

type Proposer = 'teen' | 'parent';

export const POST = handleRoute(async (ctx, req) => {
  const body = proposeSchema.parse(await req.json());
  const tenant = await assertTenant(body.child_id);
  const supabase = await createClient();

  const by: Proposer = tenant.role === 'child' ? 'teen' : 'parent';
  const row = await getScreenTimeRow(supabase, tenant.childId);
  const from = row?.status ?? 'draft';

  // State-machine gate. A pending proposal can't be overwritten by another
  // propose — the parent must review it first. A parent can never kick off
  // the initial setup (draft → proposed is teen-only).
  if (from === 'proposed') failWith(ErrorCodes.SCREEN_TIME_TRANSITION_INVALID);
  if (by === 'parent' && from === 'draft') {
    failWith(ErrorCodes.SCREEN_TIME_TRANSITION_INVALID);
  }

  const ownerId =
    row?.owner_user_id ?? (await resolveScreenTimeOwner(supabase, tenant.childId));
  if (!ownerId) failWith(ErrorCodes.INTERNAL);

  const now = new Date().toISOString();
  const values = {
    status: 'proposed',
    plan: body.plan,
    proposed_by: by,
    last_change_by: by,
    last_change_at: now,
    // A fresh proposal supersedes any open appeal against the old plan.
    appeal_reason: null,
    appeal_at: null,
    appeal_response: null,
    appeal_responded_at: null,
  };

  if (row) {
    const { error } = await supabase
      .from('screen_time_plans')
      .update(values)
      .eq('id', row.id);
    if (error) failWith(ErrorCodes.INTERNAL);
  } else {
    const { error } = await supabase.from('screen_time_plans').insert({
      child_profile_id: tenant.childId,
      owner_user_id: ownerId,
      ...values,
    });
    if (error) failWith(ErrorCodes.INTERNAL);
  }

  await auditEvent(tenant.childId, 'screen_time.proposed', {
    by,
    status_from: from,
  });
  return getScreenTimeState(supabase, tenant.childId);
});
