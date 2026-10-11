// /api/v1/children/[childId]/college/deadlines/[deadlineId]
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { deadlinePatchSchema, deleteDeadline, patchDeadline } from "@/server/services/college";

export const PATCH = handleRoute<{ childId: string; deadlineId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = deadlinePatchSchema.parse(await req.json());
  const supabase = await createClient();
  const deadline = await patchDeadline(supabase, ctx.requestId, tenant.childId, ctx.params.deadlineId, input);
  await auditEvent(tenant.childId, "college.deadline.updated", { deadline_id: ctx.params.deadlineId });
  return deadline;
});

export const DELETE = handleRoute<{ childId: string; deadlineId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const res = await deleteDeadline(supabase, ctx.requestId, tenant.childId, ctx.params.deadlineId);
  await auditEvent(tenant.childId, "college.deadline.removed", { deadline_id: ctx.params.deadlineId });
  return res;
});
