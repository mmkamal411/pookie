// POST /api/v1/children/[childId]/school/resource-library/restore —
// re-add seeded recommendations the student removed. { class_id }.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { restoreSeeds } from "@/server/services/school-resources";

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const { class_id } = z.object({ class_id: z.string().uuid() }).parse(await req.json());
  const data = await restoreSeeds(tenant.childId, class_id);
  await auditEvent(tenant.childId, "school.resource_library.restore", { class_id });
  return data;
});
