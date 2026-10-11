// /api/v1/children/[childId]/college/recommenders — recommender tracking.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { addRecommender, recommenderCreateSchema } from "@/server/services/college";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recommenders").select("*").eq("child_id", tenant.childId).order("created_at");
  if (error) throw error;
  await auditEvent(tenant.childId, "college.recommenders.viewed");
  return data ?? [];
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = recommenderCreateSchema.parse(await req.json());
  const supabase = await createClient();
  const rec = await addRecommender(supabase, ctx.requestId, tenant.childId, input);
  await auditEvent(tenant.childId, "college.recommender.added", { name: input.name });
  return rec;
});
