// POST /api/v1/children/[childId]/college/test-scores/[scoreId]/verify
// Parent-only human verification: the parent submits what the uploaded score
// report says; the route compares it against the entered row ("you entered X
// / report says Y"). Match → verified. Mismatch → 409 (nothing stored).
import { handleRoute, auditEvent } from "@/server/rest";
import { assertParent } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { testScoreVerifySchema, verifyTestScore } from "@/server/services/college";

export const POST = handleRoute<{ childId: string; scoreId: string }>(async (ctx, req) => {
  const tenant = await assertParent(ctx.params.childId);
  const input = testScoreVerifySchema.parse(await req.json());
  const supabase = await createClient();
  const score = await verifyTestScore(supabase, ctx.requestId, tenant.childId, ctx.params.scoreId, input);
  await auditEvent(tenant.childId, "college.test_score.verified", {
    score_id: ctx.params.scoreId,
    reported_total: input.reported_total,
  });
  return score;
});
