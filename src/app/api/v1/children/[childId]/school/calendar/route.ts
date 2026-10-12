// GET /api/v1/children/[childId]/school/calendar — district calendar.
// Prefers E4's school_calendar table (live ingest); falls back to the
// curated Cobb static data so the calendar never blanks.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { getCalendarEvents } from "@/server/services/school-calendar";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const data = await getCalendarEvents(tenant.childId);
  await auditEvent(tenant.childId, "school.calendar.read");
  return { ...data, source: data.live ? "school_calendar" : "cobbk12.org" };
});
