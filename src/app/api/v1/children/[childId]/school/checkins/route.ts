// POST /api/v1/children/[childId]/school/checkins — daily check-in (upsert 1 row/child/day).
// Panel redesign (FR-SCHOOL-003): the teen owns the check-in. Parents never
// POST here — the write path requires the child role. Accepts optional outcome
// estimates (metacognition) + the day-of-lab pulse (FR-SCHOOL-019).
//
// GET — the teen's own check-in for ?date= (default today), with estimates.
// Any tenant member may call it, but the service enforces requireChildRole —
// parents receive 403, never check-in content.
//
// There is deliberately no parent list route — per the W8 privacy contract,
// parent views return aggregates only, never raw check-in text.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import {
  checkinSaveSchema,
  saveCheckinV2,
  getTodayCheckin,
} from "@/server/services/school-track";

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const body = checkinSaveSchema.parse(await req.json());
  const data = await saveCheckinV2(tenant.childId, body);
  await auditEvent(tenant.childId, "checkin.saved", { date: body.date });
  return data;
});

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const date = z
    .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
    .parse(Object.fromEntries(req.nextUrl.searchParams.entries())).date;
  const day =
    date ??
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const checkin = await getTodayCheckin(tenant.childId, day);
  return { checkin };
});
