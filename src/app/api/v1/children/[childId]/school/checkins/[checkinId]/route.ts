// DELETE /api/v1/children/[childId]/school/checkins/[checkinId]
// FR-SCHOOL-003: teen-deletable check-ins — effective immediately across app
// + API. Teen-only (requireChildRole); parents can never delete or restore
// the teen's check-ins.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { deleteCheckin } from "@/server/services/school-track";

export const DELETE = handleRoute<{ childId: string; checkinId: string }>(async (ctx) => {
  const params = z
    .object({ childId: z.string().uuid(), checkinId: z.string().uuid() })
    .parse(ctx.params);
  const tenant = await assertTenant(params.childId);
  const data = await deleteCheckin(tenant.childId, params.checkinId);
  await auditEvent(tenant.childId, "checkin.deleted", { checkin_id: params.checkinId });
  return data;
});
