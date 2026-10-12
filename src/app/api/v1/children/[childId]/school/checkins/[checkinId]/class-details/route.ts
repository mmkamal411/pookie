// /api/v1/children/[childId]/school/checkins/[checkinId]/class-details —
// the astronaut debriefing: per-class check-in detail (covered / clicked /
// fuzzy / due_next / confidence). Teen-only (child-confidential).
// GET  ?class_id= — load existing debrief (prefill).
// POST — upsert the debrief for one class.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import {
  debriefSchema,
  getClassDebrief,
  saveClassDebrief,
} from "@/server/services/school-debrief";

export const GET = handleRoute<{ childId: string; checkinId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const classId = req.nextUrl.searchParams.get("class_id") ?? "";
  if (!classId) return { debrief: null };
  const debrief = await getClassDebrief(tenant.childId, ctx.params.checkinId, classId);
  await auditEvent(tenant.childId, "school.debrief.read");
  return { debrief };
});

export const POST = handleRoute<{ childId: string; checkinId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = debriefSchema.parse(await req.json());
  const debrief = await saveClassDebrief(tenant.childId, ctx.params.checkinId, input);
  await auditEvent(tenant.childId, "school.debrief.saved", { class_id: input.class_id });
  return { debrief };
});
