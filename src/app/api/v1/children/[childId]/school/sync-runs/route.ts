// GET /api/v1/children/[childId]/school/sync-runs — console run history.
// Parent-only. Query: source (optional), limit (1..100, default 30),
// before (ISO cursor for pagination). Reads school_sync_runs.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertParent } from "@/server/tenant";
import { getSyncRuns, getRunSources } from "@/server/services/sync-command";

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertParent(ctx.params.childId);
  const sp = req.nextUrl.searchParams;
  const limit = Number(sp.get("limit") ?? "30");
  const [runs, sources] = await Promise.all([
    getSyncRuns(tenant.childId, {
      source: sp.get("source") ?? undefined,
      limit: Number.isFinite(limit) ? limit : 30,
      before: sp.get("before") ?? undefined,
    }),
    getRunSources(tenant.childId),
  ]);
  await auditEvent(tenant.childId, "school.sync_runs_read");
  return { ...runs, sources: sources.sources };
});
