// GET /api/v1/children/[childId]/school/forecast/latest?class_id=
// Latest non-stale forecast + citations (any tenant member).
import { z } from "zod";
import { handleRoute } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { getLatestForecast } from "@/server/services/path90";

const querySchema = z.object({ class_id: z.string().uuid() });

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const { class_id } = querySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  return getLatestForecast(tenant.childId, class_id);
});
