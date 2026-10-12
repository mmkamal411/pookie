// PATCH /api/v1/children/[childId]/school/plans/[planId]
// FR-SCHOOL-007 — role-split writes on the teen's Path-to-90 plan:
//   - { items: [...] }      → the TEEN toggles their own action checkboxes
//                             (requireChildRole; parents get 403).
//   - { safety_status }     → PARENT review gate (requireParentRole).
// A body may carry only one kind; mixed bodies are rejected.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import {
  planItemsPatchSchema,
  togglePlanItems,
  reviewPlan,
} from "@/server/services/school-track";

const bodySchema = z
  .object({
    items: planItemsPatchSchema.shape.items.optional(),
    safety_status: z.enum(["approved", "rejected"]).optional(),
  })
  .refine((b) => (b.items ? 1 : 0) + (b.safety_status ? 1 : 0) === 1, {
    message: "send exactly one of: items (teen) or safety_status (parent)",
  });

export const PATCH = handleRoute<{ childId: string; planId: string }>(async (ctx, req) => {
  const params = z
    .object({ childId: z.string().uuid(), planId: z.string().uuid() })
    .parse(ctx.params);
  const tenant = await assertTenant(params.childId);
  const body = bodySchema.parse(await req.json());

  if (body.items) {
    const data = await togglePlanItems(tenant.childId, params.planId, body.items);
    await auditEvent(tenant.childId, "study_plan.items_toggled", { plan_id: params.planId });
    return data;
  }
  const data = await reviewPlan(tenant.childId, params.planId, body.safety_status!);
  await auditEvent(tenant.childId, "study_plan.reviewed", {
    plan_id: params.planId,
    status: body.safety_status,
  });
  return data;
});
