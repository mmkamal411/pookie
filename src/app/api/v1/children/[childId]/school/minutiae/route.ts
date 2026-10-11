// GET /api/v1/children/[childId]/school/minutiae — list the child's
// minutiae calendar (tenant-scoped read).
// POST — parent adds a manual event (the extractor writes via /ingest).
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant, assertParent } from "@/server/tenant";
import {
  getMinutiaeCalendar,
  createMinutiaeEvent,
  minutiaeCreateSchema,
} from "@/server/services/minutiae";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const events = await getMinutiaeCalendar(tenant.childId);
  return { events };
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertParent(ctx.params.childId);
  const body = minutiaeCreateSchema.parse(await req.json());
  const event = await createMinutiaeEvent(tenant.childId, body);
  await auditEvent(tenant.childId, "minutiae_event.created", {
    event_id: event.id,
    kind: event.kind,
    title: event.title,
  });
  return { event };
});
