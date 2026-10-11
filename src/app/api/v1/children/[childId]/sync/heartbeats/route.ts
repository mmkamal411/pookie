// GET /api/v1/children/[childId]/sync/heartbeats — worker liveness.
// Parent-only. One entry per device that has beaten for this child
// (windows-laptop, macbook):
//   { worker_id, status, last_seen, last_job_id, last_successful_sync_at,
//     version, last_error, is_stale }
//
// Contract notes (vs the proposed top-level GET /api/v1/workers):
// • Child-scoped, not top-level: sync_heartbeats rows carry child_id and the
//   workers sync one child's portals — a top-level endpoint would need
//   cross-tenant filtering to avoid leaking worker presence between
//   families. The UI's per-child health cards map 1:1 to this shape
//   (worker_id = device_name).
// • version / last_error are null until the 014 schema follow-up adds the
//   columns (see services/sync.ts). status carries the coarse worker state
//   ('idle' | 'running' | 'error') meanwhile.
// • is_stale = no beat in the last 15 minutes (tunable HEARTBEAT_STALE_MS).
//   The UI's green/yellow/red bands derive from last_seen client-side.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertParent } from "@/server/tenant";
import { getHeartbeats } from "@/server/services/sync";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertParent(ctx.params.childId);
  const data = await getHeartbeats(tenant.childId);
  await auditEvent(tenant.childId, "sync.heartbeats_read");
  return data;
});
