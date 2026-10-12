// /api/v1/children/[childId]/school/teacher-messages — per-class inbox + outbound drafts.
// GET  — any tenant member; optional ?class_id. Returns messages with provenance
//         labels (FR-SCHOOL-001) and counselor segregation (FR-SCHOOL-002):
//         parents see counselor threads as metadata only (body withheld,
//         ASCA B.2) and CC-redacted teacher bodies (FR-SCHOOL-016);
//         the teen sees everything.
// POST — parent-only; creates an outbound DRAFT stamped with the parent's
//        authorship (FR-AI-004: no ghostwriting — blank draft, parent-composed).
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import {
  draftTeacherMessage,
  requireParentRole,
  teacherMessageDraftSchema,
} from "@/server/services/school";
import { listTeacherMessagesLegacy } from "@/server/services/inbox";

const listQuerySchema = z.object({ class_id: z.string().uuid().optional() });

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const { class_id } = listQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  return listTeacherMessagesLegacy(tenant.childId, class_id, tenant.role === "parent");
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const parentId = await requireParentRole(tenant.childId);
  const body = teacherMessageDraftSchema.parse(await req.json());
  const data = await draftTeacherMessage(tenant.childId, body, parentId);
  await auditEvent(tenant.childId, "teacher_message.drafted", {
    class_id: body.class_id,
  });
  return data;
});
