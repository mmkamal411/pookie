// GET /api/v1/children/[childId]/school/classes/[classId] — the class page payload.
// classId is a uuid; a class outside the tenant 404s (NOT_FOUND is safe —
// existence is already tenant-scoped). resolve → assert → use → audit.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { getClassDetail } from "@/server/services/school";

const paramsSchema = z.object({
  childId: z.string().uuid(),
  classId: z.string().uuid(),
});

export const GET = handleRoute<{ childId: string; classId: string }>(async (ctx) => {
  const { childId, classId } = paramsSchema.parse(ctx.params);
  const tenant = await assertTenant(childId);
  const data = await getClassDetail(tenant.childId, classId);
  await auditEvent(tenant.childId, "grades.read");
  return data;
});
