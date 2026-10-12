// GET /api/v1/children/[childId]/school/calibration
// FR-SCHOOL-003: the teen's rolling calibration ("within ±X pts on average").
// Teen-only — the service enforces requireChildRole. No parent role, no
// service path, no briefing query may reference calibration data.
import { handleRoute } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { getCalibration } from "@/server/services/school-track";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const calibration = await getCalibration(tenant.childId);
  return { calibration };
});
