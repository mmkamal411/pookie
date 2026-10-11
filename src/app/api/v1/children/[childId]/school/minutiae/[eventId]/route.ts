// PATCH /api/v1/children/[childId]/school/minutiae/[eventId] — parent
// acknowledges (or re-opens) an event, or edits its fields.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertParent } from "@/server/tenant";
import {
  patchMinutiaeEvent,
  minutiaePatchSchema,
} from "@/server/services/minutiae";

const paramsSchema = z.object({ eventId: z.string().uuid() });

export const PATCH = handleRoute<{ childId: string; eventId: string }>(async (ctx, req) => {
  const tenant = await assertParent(ctx.params.childId);
  const { eventId } = paramsSchema.parse(ctx.params);
  const body = minutiaePatchSchema.parse(await req.json());
  const event = await patchMinutiaeEvent(
    tenant.childId,
    eventId,
    tenant.userId,
    body,
  );
  await auditEvent(tenant.childId, "minutiae_event.updated", {
    event_id: event.id,
    ack: event.ack,
  });
  return { event };
});
