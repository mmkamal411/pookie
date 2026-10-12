// GET /api/v1/children/[childId]/school/sparks — Study Sparks (FR-SCHOOL-004).
// Returns live (non-expired) sparks with their provenance labels. The pipeline
// writes rows; this route only reads. Empty list when none are live — never a
// fabricated spark.
import { z } from "zod";
import { handleRoute } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { listStudySparks } from "@/server/services/school-track";

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const { class_id } = z
    .object({ class_id: z.string().uuid().optional() })
    .parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  return listStudySparks(tenant.childId, class_id);
});
