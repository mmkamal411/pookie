// /api/v1/children/[childId]/sync/requests — the sync queue (Sync console).
// Parent-only.
//
// GET  — last 20 sync jobs, newest first (?limit=1..50). Each job:
//        { id, status: pending|running|complete|failed, device, summary,
//          errors: string[], created_at, claimed_at, completed_at }
//        Contract notes:
//        • The new project's canonical table is sync_jobs (013_sync_queue.sql).
//          `sync_requests` is the LEGACY dawson-checkin project's table —
//          untouched.
//        • DB status 'claimed' is presented as 'running' (worker picked it up).
//        • There is no started_at column: claimed_at is the equivalent.
//        • There is no error column: errors[] is extracted server-side from the
//          job's log lines (level error/fatal/critical), newest first, max 5.
// POST — "Sync Now": enqueues a pending job the laptop workers poll for.
//        → { job: { id, status: "pending" } }
import { handleRoute, auditEvent } from "@/server/rest";
import { assertParent } from "@/server/tenant";
import { getSyncStatus, requestSync } from "@/server/services/sync";

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertParent(ctx.params.childId);
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.floor(limitParam), 1), 50)
    : 20;
  const data = await getSyncStatus(tenant.childId, limit);
  await auditEvent(tenant.childId, "sync.status_read");
  return data;
});

export const POST = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertParent(ctx.params.childId);
  const data = await requestSync(tenant.childId);
  await auditEvent(tenant.childId, "sync.requested", { job_id: data.job.id });
  return data;
});
