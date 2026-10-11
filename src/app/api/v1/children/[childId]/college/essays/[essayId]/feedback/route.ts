// POST /api/v1/children/[childId]/college/essays/[essayId]/feedback
// AI feedback hook — tenant-partitioned STUB. No AI provider is called and
// nothing is persisted (009 has no feedback column by design). The call site
// is src/server/essay-feedback.ts; wire a provider there when approved.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { feedbackForEssay } from "@/server/services/college";

export const POST = handleRoute<{ childId: string; essayId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const result = await feedbackForEssay(supabase, ctx.requestId, tenant.childId, ctx.params.essayId);
  await auditEvent(tenant.childId, "college.essay.feedback_requested", { essay_id: ctx.params.essayId });
  return result;
});
