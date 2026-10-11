// /api/v1/children/[childId]/school/assignments — manual tasks + list.
// GET  — any tenant member; optional ?class_id.
// POST — parent-only manual rows (source_id NULL; sync upserts never collide with them).
// resolve → assert → use → audit.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import {
  assignmentCreateSchema,
  createAssignment,
  listAssignments,
  requireParentRole,
} from "@/server/services/school";

const listQuerySchema = z.object({ class_id: z.string().uuid().optional() });

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const { class_id } = listQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  return listAssignments(tenant.childId, class_id);
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  await requireParentRole(tenant.childId);
  const body = assignmentCreateSchema.parse(await req.json());
  const data = await createAssignment(tenant.childId, body);
  await auditEvent(tenant.childId, "assignment.created", { class_id: body.class_id });
  return data;
});
