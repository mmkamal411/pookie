// POST /api/v1/children/[childId]/school/checkins — daily check-in (upsert 1 row/child/day).
// Any tenant member may write (child writes their own; parent may backfill).
// There is deliberately no parent list route here — per the W8 privacy
// contract, parent views return aggregates only, never raw check-in text.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { checkinSchema, saveCheckin } from "@/server/services/school";

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const body = checkinSchema.parse(await req.json());
  const data = await saveCheckin(tenant.childId, body);
  await auditEvent(tenant.childId, "checkin.saved", { date: body.date });
  return data;
});
