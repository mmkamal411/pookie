// GET /api/v1/children/[childId]/school/classes/[classId] — the class page payload.
// classId is a uuid; a class outside the tenant 404s (NOT_FOUND is safe —
// existence is already tenant-scoped). resolve → assert → use → audit.
//
// FR-SCHOOL-002: counselor threads in the payload are metadata-only for
// parents (body stripped, body_withheld set); the teen sees everything.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { getClassDetail } from "@/server/services/school";
import { tenantRoleFor } from "@/server/services/school-track";

const paramsSchema = z.object({
  childId: z.string().uuid(),
  classId: z.string().uuid(),
});

export const GET = handleRoute<{ childId: string; classId: string }>(async (ctx) => {
  const { childId, classId } = paramsSchema.parse(ctx.params);
  const tenant = await assertTenant(childId);
  const data = await getClassDetail(tenant.childId, classId);
  await auditEvent(tenant.childId, "grades.read");

  const role = await tenantRoleFor(tenant.childId);
  if (role === "parent") {
    data.teacher_thread = data.teacher_thread.map((m) =>
      m.sender_type === "counselor" ? { ...m, body: "", body_withheld: true } : m,
    );
  }
  return data;
});
