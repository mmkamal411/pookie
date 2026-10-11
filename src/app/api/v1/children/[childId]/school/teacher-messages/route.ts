// /api/v1/children/[childId]/school/teacher-messages — per-class inbox + outbound drafts.
// GET  — any tenant member; optional ?class_id.
// POST — parent-only; creates an outbound DRAFT (nothing sends without approval).
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import {
  draftTeacherMessage,
  listTeacherMessages,
  requireParentRole,
  teacherMessageDraftSchema,
} from "@/server/services/school";

const listQuerySchema = z.object({ class_id: z.string().uuid().optional() });

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const { class_id } = listQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  return listTeacherMessages(tenant.childId, class_id);
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  await requireParentRole(tenant.childId);
  const body = teacherMessageDraftSchema.parse(await req.json());
  const data = await draftTeacherMessage(tenant.childId, body);
  await auditEvent(tenant.childId, "teacher_message.drafted", {
    class_id: body.class_id,
  });
  return data;
});
