// /api/v1/children/[childId]/college/recommenders/[recId]
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { deleteRecommender, patchRecommender, recommenderPatchSchema } from "@/server/services/college";

export const PATCH = handleRoute<{ childId: string; recId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = recommenderPatchSchema.parse(await req.json());
  const supabase = await createClient();
  const rec = await patchRecommender(supabase, ctx.requestId, tenant.childId, ctx.params.recId, input);
  await auditEvent(tenant.childId, "college.recommender.updated", { recommender_id: ctx.params.recId });
  return rec;
});

export const DELETE = handleRoute<{ childId: string; recId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const res = await deleteRecommender(supabase, ctx.requestId, tenant.childId, ctx.params.recId);
  await auditEvent(tenant.childId, "college.recommender.removed", { recommender_id: ctx.params.recId });
  return res;
});
