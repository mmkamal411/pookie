// GET /api/v1/children/[childId]/school/classes — class grid (no due_next).
// Powers the Academics grid. resolve → assert → use → audit.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { getSchoolOverview } from "@/server/services/school";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const { classes } = await getSchoolOverview(tenant.childId);
  await auditEvent(tenant.childId, "grades.read");
  return { classes };
});
