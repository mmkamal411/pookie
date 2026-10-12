// GET /api/v1/children/[childId]/school/graduation-audit
// FR-SCHOOL-013 (G21): deterministic GA 23-credit graduation audit.
// Stamps requirements_version; fuzzy buckets go to the student-confirm queue
// (never auto-aligned on a guess).
import { handleRoute } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { getGraduationAudit } from "@/server/services/graduation";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  return getGraduationAudit(tenant.childId);
});
