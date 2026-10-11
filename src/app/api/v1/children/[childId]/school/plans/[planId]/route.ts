// PATCH /api/v1/children/[childId]/school/plans/[planId] — parent-only.
// Flips done flags on ranked actions and/or reviews safety_status
// (pending → approved/rejected — the write-path safety gate).
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { patchPlan, planPatchSchema, requireParentRole } from "@/server/services/school";

export const PATCH = handleRoute<{ childId: string; planId: string }>(async (ctx, req) => {
  const params = z
    .object({ childId: z.string().uuid(), planId: z.string().uuid() })
    .parse(ctx.params);
  const tenant = await assertTenant(params.childId);
  await requireParentRole(tenant.childId);
  const body = planPatchSchema.parse(await req.json());
  const data = await patchPlan(tenant.childId, params.planId, body);
  await auditEvent(tenant.childId, "study_plan.updated", { plan_id: params.planId });
  return data;
});
