// /api/v1/children/[childId]/school/calibration/estimates
// FR-SCHOOL-003: the teen's outcome estimates (metacognition).
// TEEN-ONLY — every function requires the child role; RLS independently
// restricts the tables to the owning teen. Parents get 403, never estimates.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { estimateSchema, listEstimates, recordEstimate } from "@/server/services/calibration";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  return listEstimates(tenant.childId);
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const body = estimateSchema.parse(await req.json());
  const data = await recordEstimate(tenant.childId, body);
  await auditEvent(tenant.childId, "calibration.estimate_recorded", {});
  return data;
});
