// GET /api/v1/children/[childId]/school/weather — 5-day Marietta forecast
// via Open-Meteo (server-side, cached). Falls back to a seasonal snapshot
// so the UI never blanks.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { getWeatherForecast } from "@/server/services/school-weather";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const { days, live } = await getWeatherForecast();
  await auditEvent(tenant.childId, "school.weather.read");
  return { days, live, source: "Open-Meteo", location: "Marietta, GA" };
});
