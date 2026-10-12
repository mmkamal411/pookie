// GET /api/v1/children/[childId]/school/dashboard — consolidated overview
// payload: semester card, GPA block, attendance, trivia, weather, and a
// sync-health summary. resolve → assert → use → audit. Never 500s on missing
// data — every section degrades to a sensible default.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import {
  getAttendance,
  getDidYouKnow,
  getGpaBlock,
  getSemesterCard,
} from "@/server/services/school-enrich";
import { getWeatherForecast } from "@/server/services/school-weather";
import { getSyncHealth } from "@/server/services/school-sync-health";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);

  const [semester, gpa, attendance, weather, health] = await Promise.all([
    Promise.resolve(getSemesterCard()),
    getGpaBlock(tenant.childId),
    getAttendance(tenant.childId),
    getWeatherForecast(),
    getSyncHealth(tenant.childId),
  ]);

  await auditEvent(tenant.childId, "school.dashboard.read");

  return {
    semester,
    gpa,
    attendance,
    trivia: getDidYouKnow(),
    weather: { days: weather.days, live: weather.live, source: "Open-Meteo" },
    health: {
      allGreen: health.allGreen,
      sources: health.sources.map((s) => ({
        source: s.source,
        name: s.name,
        freshness: s.freshness,
        ageMinutes: s.ageMinutes,
      })),
      checkedAt: health.checkedAt,
    },
  };
});
