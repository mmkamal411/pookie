// POST /api/v1/children/[childId]/school/teacher-messages/[msgId]/send
// Parent-only. Requires status='approved' (409 CONFLICT otherwise) and the
// send window (409 outside 06:00–22:00 child-local). Audits teacher_message.sent
// — FERPA disclosure accounting. v1 marks sent; transmission is future work.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { sendTeacherMessage } from "@/server/services/school";

const paramsSchema = z.object({
  childId: z.string().uuid(),
  msgId: z.string().uuid(),
});

export const POST = handleRoute<{ childId: string; msgId: string }>(async (ctx) => {
  const { childId, msgId } = paramsSchema.parse(ctx.params);
  const tenant = await assertTenant(childId);
  const data = await sendTeacherMessage(tenant.childId, msgId);
  await auditEvent(tenant.childId, "teacher_message.sent", { message_id: msgId });
  return data;
});
