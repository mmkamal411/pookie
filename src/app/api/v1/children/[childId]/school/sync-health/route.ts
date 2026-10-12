// GET /api/v1/children/[childId]/school/sync-health — full pull-health
// mission-control payload (one row per source). resolve → assert → use →
// audit. Never 500s: the service degrades to "Awaiting First Run" rows when
// the table is missing or empty.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { getSyncHealth } from "@/server/services/school-sync-health";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const data = await getSyncHealth(tenant.childId);
  await auditEvent(tenant.childId, "school.sync_health.read");
  return data;
});
