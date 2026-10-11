// /api/v1/children/[childId]/school/plans — Path-to-90 plans.
// GET  — any tenant member; RLS gates child-role callers to safety_status='approved'.
// POST — parent-only authored plans (arrive as safety_status='pending'); committee plans
//        arrive via the service_role worker, never this route.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import {
  createPlan,
  listPlans,
  planCreateSchema,
  requireParentRole,
} from "@/server/services/school";

const listQuerySchema = z.object({
  class_id: z.string().uuid().optional(),
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const { class_id, week } = listQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  return listPlans(tenant.childId, class_id, week);
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  await requireParentRole(tenant.childId);
  const body = planCreateSchema.parse(await req.json());
  const data = await createPlan(tenant.childId, body);
  await auditEvent(tenant.childId, "study_plan.created", { class_id: body.class_id });
  return data;
});
