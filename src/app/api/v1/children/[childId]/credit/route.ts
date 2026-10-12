// GET /api/v1/children/[childId]/credit — W24 minor freeze management state.
// POST — seed the five bureau rows ('not_requested' / counsel 'pending').
// GATE: the module is gated behind FCRA counsel sign-off. Freeze actions stay
// inert until counsel_review_status flips to 'approved' (flipped by counsel,
// never by a deploy). The API always returns the honest gate state — the UI
// builds its "pending review" surface from this contract.
import { handleRoute, auditEvent } from '@/server/rest';
import { assertParent } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { getCreditModuleState, seedFreezeRows } from '@/server/services/credit';

type Params = { childId: string };

export const GET = handleRoute<Params>(async (ctx) => {
  const tenant = await assertParent(ctx.params.childId);
  const supabase = await createClient();
  const state = await getCreditModuleState(supabase, tenant.childId);
  await auditEvent(tenant.childId, 'credit_module.viewed', {
    counsel_review_status: state.counsel_review_status,
  });
  return state;
});

export const POST = handleRoute<Params>(async (ctx) => {
  const tenant = await assertParent(ctx.params.childId);
  const supabase = await createClient();
  const freezes = await seedFreezeRows(supabase, tenant.childId, tenant.userId);
  await auditEvent(tenant.childId, 'credit_freezes.seeded', {
    count: freezes.length,
  });
  return { freezes, counsel_review_status: 'pending' as const };
});
