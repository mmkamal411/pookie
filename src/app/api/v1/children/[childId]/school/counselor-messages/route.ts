// GET /api/v1/children/[childId]/school/counselor-messages
// FR-SCHOOL-002 (ASCA B.2): counselor threads, segregated.
// The teen sees the full thread; parents see METADATA ONLY (body always null
// on the parent path — enforced in the service, not just the UI).
import { handleRoute } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { listCounselorThreads } from "@/server/services/inbox";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  return listCounselorThreads(tenant.childId, tenant.role === "parent");
});
