// /api/v1/children/[childId]/college/essays/[essayId]
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { deleteEssay, essayPatchSchema, patchEssay } from "@/server/services/college";

export const PATCH = handleRoute<{ childId: string; essayId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = essayPatchSchema.parse(await req.json());
  const supabase = await createClient();
  const essay = await patchEssay(supabase, ctx.requestId, tenant.childId, ctx.params.essayId, input);
  await auditEvent(tenant.childId, "college.essay.updated", { essay_id: ctx.params.essayId });
  return essay;
});

export const DELETE = handleRoute<{ childId: string; essayId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const res = await deleteEssay(supabase, ctx.requestId, tenant.childId, ctx.params.essayId);
  await auditEvent(tenant.childId, "college.essay.removed", { essay_id: ctx.params.essayId });
  return res;
});
