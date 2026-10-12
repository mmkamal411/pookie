// POST /api/v1/children/[childId]/school/sync-now — trigger a sync.
// Parent-only. Body: { source?: string }. Enqueues through the existing
// sync_request_job RPC (E2's SYNC NOW mechanism). The queue runs full pulls,
// so the response note is honest about what "per source" means here.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertParent } from "@/server/tenant";
import { requestSourceSync } from "@/server/services/sync-command";

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertParent(ctx.params.childId);
  const body = (await req.json().catch(() => ({}))) as { source?: string };
  const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "all sources";
  const data = await requestSourceSync(tenant.childId, source);
  await auditEvent(tenant.childId, "school.sync_requested", { job_id: data.job.id, source });
  return data;
});
