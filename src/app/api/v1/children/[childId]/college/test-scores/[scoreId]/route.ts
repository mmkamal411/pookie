// /api/v1/children/[childId]/college/test-scores/[scoreId]
// Editing a verified score un-verifies it (the human check must be redone).
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { deleteTestScore, patchTestScore, testScorePatchSchema } from "@/server/services/college";

export const PATCH = handleRoute<{ childId: string; scoreId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = testScorePatchSchema.parse(await req.json());
  const supabase = await createClient();
  const score = await patchTestScore(supabase, ctx.requestId, tenant.childId, ctx.params.scoreId, input);
  await auditEvent(tenant.childId, "college.test_score.updated", { score_id: ctx.params.scoreId });
  return score;
});

export const DELETE = handleRoute<{ childId: string; scoreId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const res = await deleteTestScore(supabase, ctx.requestId, tenant.childId, ctx.params.scoreId);
  await auditEvent(tenant.childId, "college.test_score.removed", { score_id: ctx.params.scoreId });
  return res;
});
