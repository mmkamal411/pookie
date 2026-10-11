// GET /api/v1/children/[childId]/school/due-next — reads the due_next view.
// Query: days (1–30, default 14), class_id (optional uuid).
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { getDueNext } from "@/server/services/school";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(14),
  class_id: z.string().uuid().optional(),
});

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const { days, class_id } = querySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  const data = await getDueNext(tenant.childId, days, class_id);
  await auditEvent(tenant.childId, "due_next.read");
  return data;
});
