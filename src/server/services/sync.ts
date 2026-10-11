// Sync Status + Agent Heartbeat — framework-free business logic.
//
// BACKEND CONTRACT (013_sync_queue.sql, DBA review pending — NOT yet applied
// to the pookie project):
//   * sync_jobs / sync_heartbeats carry RLS enabled with NO policies and are
//     granted to service_role ONLY. There is intentionally no client read
//     path. Every function here runs through supabaseAdmin (server-only) and
//     MUST be called from a route that already asserted parent role via
//     assertParent() — the explicit child_id filter below is the tenancy
//     enforcement (RLS is bypassed for service_role by design).
//   * The task brief asked for a `sync_requests` table — the new project's
//     canonical queue table is `sync_jobs` (013). `sync_requests` belongs to
//     the LEGACY dawson-checkin project (qtzvunuqbnikvgttidco) and stays
//     untouched. The contract below maps legacy naming to the new schema:
//       legacy sync_requests.summary  -> sync_jobs.summary
//       legacy worker identifier      -> sync_jobs.device_name (set by the
//                                        worker) / sync_heartbeats.device_name
//       legacy error column           -> sync_jobs.log (jsonb array of
//                                        {t, level, line}); error lines are
//                                        extracted server-side (no `error`
//                                        column exists in 013).
//
// SCHEMA FOLLOW-UP (proposed migration 014, needs DBA): the heartbeat table
// has NO `version` or `last_error` columns (brief §3 asks for both). Until
// 014 lands, WorkerHeartbeat.version/last_error return null and `status`
// carries the worker's coarse state ('idle' | 'running' | 'error').
import { supabaseAdmin } from "@/lib/supabase/admin";

/** A worker is considered stale when it has not beaten for this long. Tunable. */
const HEARTBEAT_STALE_MS = 15 * 60 * 1000;

export type SyncJobStatus = "pending" | "claimed" | "complete" | "failed";

/**
 * API-facing status vocabulary. The DB stores 'claimed' (worker picked the
 * job up); the API presents it as 'running' — clearer for the Sync console
 * and matches the frontend contract. The DB value is never rewritten.
 */
export type ApiSyncJobStatus = "pending" | "running" | "complete" | "failed";

export interface SyncJobSummary {
  id: string;
  status: ApiSyncJobStatus;
  /** Worker that handled the job (sync_jobs.device_name; null on legacy rows). */
  device: string | null;
  summary: string | null;
  /** Error lines extracted from the job log (level = error/fatal/critical), newest first. */
  errors: string[];
  created_at: string;
  /** When the worker claimed the job (the DB's claimed_at; the UI's "started"). */
  claimed_at: string | null;
  completed_at: string | null;
}

interface JobLogLine {
  t?: string;
  level?: string;
  line?: string;
}

function extractErrors(log: unknown): string[] {
  if (!Array.isArray(log)) return [];
  const errors: string[] = [];
  for (const entry of log as JobLogLine[]) {
    const level = (entry?.level ?? "").toLowerCase();
    if (level === "error" || level === "fatal" || level === "critical") {
      const line = (entry?.line ?? "").trim();
      if (line) errors.push(line);
    }
  }
  return errors.slice(-5).reverse();
}

/** Last 20 sync jobs for the child, newest first. Parent-asserted by the route. */
export async function getSyncStatus(
  childId: string,
  limit = 20,
): Promise<{ jobs: SyncJobSummary[] }> {
  const { data, error } = await supabaseAdmin
    .from("sync_jobs")
    .select("id, status, device_name, summary, log, created_at, claimed_at, completed_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) throw error;
  const jobs: SyncJobSummary[] = ((data ?? []) as Array<{
    id: string;
    status: SyncJobStatus;
    device_name: string | null;
    summary: string | null;
    log: unknown;
    created_at: string;
    claimed_at: string | null;
    completed_at: string | null;
  }>).map((j) => ({
    id: j.id,
    // DB 'claimed' -> API 'running' (worker picked it up; the sweep is underway).
    status: (j.status === "claimed" ? "running" : j.status) as ApiSyncJobStatus,
    device: j.device_name,
    summary: j.summary,
    errors: extractErrors(j.log),
    created_at: j.created_at,
    claimed_at: j.claimed_at,
    completed_at: j.completed_at,
  }));
  return { jobs };
}

/**
 * SYNC NOW — enqueue a pending job the laptop workers poll for.
 * Calls sync_request_job() via the admin client (the RPC is service_role-only;
 * the route asserts parent role first). Raises when the child is unknown.
 */
export async function requestSync(
  childId: string,
): Promise<{ job: { id: string; status: ApiSyncJobStatus } }> {
  const { data, error } = await supabaseAdmin.rpc("sync_request_job", {
    p_child_id: childId,
  });
  if (error) throw error;
  const job = data as { id: string; status: SyncJobStatus };
  return {
    job: {
      id: job.id,
      status: (job.status === "claimed" ? "running" : job.status) as ApiSyncJobStatus,
    },
  };
}

export interface WorkerHeartbeat {
  /** Worker identity — the device_name the worker reports (e.g. 'windows-laptop'). */
  worker_id: string;
  status: string;
  last_seen: string;
  last_job_id: string | null;
  /**
   * Newest completed_at among this worker's 'complete' jobs. Best-effort:
   * older jobs may carry device_name NULL, so a worker with no attributed
   * completions reports null here even if it synced successfully.
   */
  last_successful_sync_at: string | null;
  /** SCHEMA FOLLOW-UP (014): null until the column exists. */
  version: string | null;
  /** SCHEMA FOLLOW-UP (014): null until the column exists. */
  last_error: string | null;
  /** True when last_seen is older than HEARTBEAT_STALE_MS. */
  is_stale: boolean;
}

/** Liveness for every worker that has beaten for this child. Parent-asserted by the route. */
export async function getHeartbeats(
  childId: string,
): Promise<{ workers: WorkerHeartbeat[] }> {
  const [{ data: beats, error: beatErr }, { data: jobs, error: jobErr }] = await Promise.all([
    supabaseAdmin
      .from("sync_heartbeats")
      .select("device_name, status, last_job_id, last_heartbeat")
      .eq("child_id", childId)
      .order("last_heartbeat", { ascending: false }),
    supabaseAdmin
      .from("sync_jobs")
      .select("device_name, completed_at")
      .eq("child_id", childId)
      .eq("status", "complete")
      .not("device_name", "is", null)
      .order("completed_at", { ascending: false })
      .limit(100),
  ]);
  if (beatErr) throw beatErr;
  if (jobErr) throw jobErr;
  const lastSuccess = new Map<string, string>();
  for (const j of (jobs ?? []) as Array<{ device_name: string; completed_at: string }>) {
    if (!lastSuccess.has(j.device_name)) lastSuccess.set(j.device_name, j.completed_at);
  }
  const now = Date.now();
  const workers: WorkerHeartbeat[] = ((beats ?? []) as Array<{
    device_name: string;
    status: string;
    last_job_id: string | null;
    last_heartbeat: string;
  }>).map((h) => ({
    worker_id: h.device_name,
    status: h.status,
    last_seen: h.last_heartbeat,
    last_job_id: h.last_job_id,
    last_successful_sync_at: lastSuccess.get(h.device_name) ?? null,
    version: null,
    last_error: null,
    is_stale: now - new Date(h.last_heartbeat).getTime() > HEARTBEAT_STALE_MS,
  }));
  return { workers };
}
