// /api/v1/children/[childId]/college/test-scores — manual entry.
// There is deliberately NO CollegeBoard/ACT integration: scores are entered
// by hand and verified against an uploaded report ("you entered X / report
// says Y"). Scraping is rejected by design.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { addTestScore, testScoreCreateSchema } from "@/server/services/college";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_scores").select("*").eq("child_id", tenant.childId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  await auditEvent(tenant.childId, "college.test_scores.viewed");
  return data ?? [];
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = testScoreCreateSchema.parse(await req.json());
  const supabase = await createClient();
  const score = await addTestScore(supabase, ctx.requestId, tenant.childId, input);
  await auditEvent(tenant.childId, "college.test_score.added", { test: input.test });
  return score;
});
