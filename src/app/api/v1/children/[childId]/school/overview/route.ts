// GET /api/v1/children/[childId]/school/overview — grades dashboard payload.
// resolve → assert → use → audit. Audits grades.read (bulk read of consequence).
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { getSchoolOverview } from "@/server/services/school";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const data = await getSchoolOverview(tenant.childId);
  await auditEvent(tenant.childId, "grades.read");
  return data;
});
