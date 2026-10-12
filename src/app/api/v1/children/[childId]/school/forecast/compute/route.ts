// POST /api/v1/children/[childId]/school/forecast/compute?class_id=
// FR-SCHOOL-007: deterministic Path-to-90 forecast. Any tenant member may
// compute — the engine is a pure function over school-of-record inputs
// (gradebook sync → per-category earned/possible; classes.grade_weights;
// due_next → known remaining). The LLM never computes grades. The stored row
// carries engine_version + inputs_hash + citations; older rows with a changed
// hash are marked stale.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { computeClassForecast } from "@/server/services/path90";

const querySchema = z.object({ class_id: z.string().uuid() });

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const { class_id } = querySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  const data = await computeClassForecast(tenant.childId, class_id);
  await auditEvent(tenant.childId, "forecast.computed", { class_id });
  return data;
});
