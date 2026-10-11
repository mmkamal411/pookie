// POST /api/v1/children/[childId]/school/minutiae/ingest — idempotent bulk
// ingest for the school-comms extractor (W1 pipeline). Parent-role gated;
// the service upserts via the service_role client with an explicit child_id
// (ADR-004 invariant), ON CONFLICT (dedupe_key) DO NOTHING — re-running the
// extractor over the same emails never duplicates calendar items.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertParent } from "@/server/tenant";
import {
  ingestMinutiaeEvents,
  minutiaeIngestSchema,
} from "@/server/services/minutiae";

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertParent(ctx.params.childId);
  const body = minutiaeIngestSchema.parse(await req.json());
  const counts = await ingestMinutiaeEvents(tenant.childId, body.events);
  await auditEvent(tenant.childId, "minutiae.ingested", {
    inserted: counts.inserted,
    skipped_dupe: counts.skipped_dupe,
  });
  return counts;
});
