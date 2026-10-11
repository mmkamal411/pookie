// GET /api/v1/children/[childId]/college/readiness — the application-readiness
// dashboard aggregate: list, deadlines (with derived 30/14/7/2-day buckets),
// derived requirement checklists, essays, recommenders, scores, releases, GPA.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { getReadiness } from "@/server/services/college";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const readiness = await getReadiness(supabase, tenant.childId);
  await auditEvent(tenant.childId, "college.readiness.viewed");
  return readiness;
});
