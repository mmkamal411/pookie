// GET /api/v1/children/[childId]/school/workers — fleet status for WIN + MAC.
// Parent-only. Honest about silence: a worker that never reported comes back
// with status "never" and the UI shows "Awaiting First Contact".
import { handleRoute, auditEvent } from "@/server/rest";
import { assertParent } from "@/server/tenant";
import { getFleetStatus } from "@/server/services/sync-command";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertParent(ctx.params.childId);
  const data = await getFleetStatus(tenant.childId);
  await auditEvent(tenant.childId, "school.workers_read");
  return data;
});
