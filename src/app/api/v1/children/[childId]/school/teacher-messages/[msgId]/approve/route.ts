// POST /api/v1/children/[childId]/school/teacher-messages/[msgId]/approve
// Parent-only. Approves the EXACT body as stored. Enforces the standing
// send window (06:00–22:00 child-local): quiet-hour approvals are HELD —
// the response carries held:true + send_after_date; auto-send is a future worker.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { approveTeacherMessage } from "@/server/services/school";

const paramsSchema = z.object({
  childId: z.string().uuid(),
  msgId: z.string().uuid(),
});

export const POST = handleRoute<{ childId: string; msgId: string }>(async (ctx) => {
  const { childId, msgId } = paramsSchema.parse(ctx.params);
  const tenant = await assertTenant(childId);
  const data = await approveTeacherMessage(tenant.childId, msgId);
  await auditEvent(tenant.childId, "teacher_message.approved", {
    message_id: msgId,
    held: data.held,
  });
  return data;
});
