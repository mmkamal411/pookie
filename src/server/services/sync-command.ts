// Sync Command Center backend — fleet status + run history for the console.
// Reads E4's tables: school_sync_runs (066, per-run log), sync_heartbeats
// (liveness), sync_jobs (013, the SYNC NOW queue).
// NO MOCK DATA — silent workers/runs are reported as "awaiting first contact".
// Routes assert parent role first; reads go through the admin client like
// services/sync.ts.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { requestSync } from "@/server/services/sync";
import { guardServiceError } from "@/server/services/backend-availability";

/** Canonical fleet — Mehedi's names: windows-laptop is WIN, MacBook is MAC. */
export const FLEET = [
  {
    key: "WIN",
    device: "windows-laptop",
    match: ["windows-laptop", "dashawnalien"],
    title: "WIN",
    subtitle: "Windows Laptop · Cobb Network",
    responsibilities: [
      "StudentVUE gradebook detail",
      "CTLS Learn announcements",
      "School Outlook mail",
    ],
    note: "The only box that passes Cobb Conditional Access.",
  },
  {
    key: "MAC",
    device: "macbook",
    match: ["macbook", "z"],
    title: "MAC",
    subtitle: "MacBook · Home Network",
    responsibilities: ["3:05 AM auto-sync", "Secondary pull path"],
    note: "Zero-guard stays on — its data is verified before trust.",
  },
] as const;

export type FleetKey = (typeof FLEET)[number]["key"];

export interface FleetWorker {
  key: FleetKey;
  device: string;
  title: string;
  subtitle: string;
  responsibilities: string[];
  note: string;
  /** Coarse status: online | stale | offline | never */
  status: "online" | "stale" | "offline" | "never";
  lastSeen: string | null;
  lastSuccessAt: string | null;
  /** A run started on this machine with no finish yet (last 45 min). */
  syncingNow: boolean;
  workerStatus: string | null;
}

function matchFleet(deviceName: string | null): FleetKey | null {
  if (!deviceName) return null;
  const d = deviceName.toLowerCase();
  for (const f of FLEET) {
    if (f.match.some((m) => d.includes(m))) return f.key;
  }
  return null;
}

/** Fleet status for one child — WIN and MAC cards, honest about silence. */
export async function getFleetStatus(childId: string): Promise<{ workers: FleetWorker[] }> {
  // Missing service key or missing tables (013/066 not migrated)
  // → 503 SERVICE_NOT_READY, never a 500.
  const activeSince = new Date(Date.now() - 45 * 60_000).toISOString();
  let beats: Array<{ device_name: string; status: string; last_heartbeat: string }> | null = null;
  let jobs: Array<{ device_name: string; completed_at: string }> | null = null;
  let active: Array<{ machine: string }> | null = null;
  try {
    const [
      { data: beatRows, error: beatErr },
      { data: jobRows, error: jobErr },
      { data: activeRows, error: actErr },
    ] = await Promise.all([
      supabaseAdmin
        .from("sync_heartbeats")
        .select("device_name, status, last_heartbeat")
        .eq("child_id", childId)
        .order("last_heartbeat", { ascending: false }),
      supabaseAdmin
        .from("sync_jobs")
        .select("device_name, completed_at")
        .eq("child_id", childId)
        .eq("status", "complete")
        .not("device_name", "is", null)
        .order("completed_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("school_sync_runs")
        .select("machine")
        .eq("child_id", childId)
        .is("finished_at", null)
        .gte("started_at", activeSince),
    ]);
    if (beatErr) throw beatErr;
    if (jobErr) throw jobErr;
    if (actErr) throw actErr;
    beats = (beatRows ?? []) as Array<{ device_name: string; status: string; last_heartbeat: string }>;
    jobs = (jobRows ?? []) as Array<{ device_name: string; completed_at: string }>;
    active = (activeRows ?? []) as Array<{ machine: string }>;
  } catch (err) {
    guardServiceError(err);
  }

  const lastSuccess = new Map<FleetKey, string>();
  for (const j of jobs ?? []) {
    const key = matchFleet(j.device_name);
    if (key && !lastSuccess.has(key)) lastSuccess.set(key, j.completed_at);
  }
  const syncing = new Set<FleetKey>();
  for (const r of active ?? []) {
    const key = matchFleet(r.machine);
    if (key) syncing.add(key);
  }

  const now = Date.now();
  const workers: FleetWorker[] = FLEET.map((f) => {
    const beat = (beats ?? []).find((b) => matchFleet(b.device_name) === f.key);
    const lastSeen = beat?.last_heartbeat ?? null;
    let status: FleetWorker["status"] = "never";
    if (lastSeen) {
      const ageH = (now - new Date(lastSeen).getTime()) / 3_600_000;
      status = ageH < 1 ? "online" : ageH < 12 ? "stale" : "offline";
    }
    return {
      key: f.key,
      device: f.device,
      title: f.title,
      subtitle: f.subtitle,
      responsibilities: [...f.responsibilities],
      note: f.note,
      status,
      lastSeen,
      lastSuccessAt: lastSuccess.get(f.key) ?? null,
      syncingNow: syncing.has(f.key) || beat?.status === "running",
      workerStatus: beat?.status ?? null,
    };
  });
  return { workers };
}

export interface SyncRun {
  id: string;
  source: string;
  machine: string;
  startedAt: string;
  finishedAt: string | null;
  durationSec: number | null;
  rowsPulled: number;
  tables: Record<string, number>;
  success: boolean | null;
  error: string | null;
}

/** Paginated run history from school_sync_runs — the console's log lines. */
export async function getSyncRuns(
  childId: string,
  opts: { source?: string; limit?: number; before?: string } = {},
): Promise<{ runs: SyncRun[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? 30), 1), 100);
  // Missing service key or missing school_sync_runs (066 not migrated)
  // → 503 SERVICE_NOT_READY, never a 500.
  let rows: Array<{
    id: string;
    source_name: string;
    machine: string;
    started_at: string;
    finished_at: string | null;
    rows_pulled: number;
    rows_by_table: Record<string, number> | null;
    error_text: string | null;
    success: boolean | null;
  }>;
  try {
    let q = supabaseAdmin
      .from("school_sync_runs")
      .select("id, source_name, machine, started_at, finished_at, rows_pulled, rows_by_table, error_text, success")
      .eq("child_id", childId)
      .order("started_at", { ascending: false })
      .limit(limit + 1);
    if (opts.source) q = q.eq("source_name", opts.source);
    if (opts.before) q = q.lt("started_at", opts.before);
    const { data, error } = await q;
    if (error) throw error;
    rows = (data ?? []) as typeof rows;
  } catch (err) {
    guardServiceError(err);
  }
  const hasMore = rows.length > limit;
  const runs: SyncRun[] = rows.slice(0, limit).map((r) => ({
    id: r.id,
    source: r.source_name,
    machine: r.machine,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationSec:
      r.finished_at != null
        ? Math.max(0, Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000))
        : null,
    rowsPulled: r.rows_pulled ?? 0,
    tables: r.rows_by_table ?? {},
    success: r.success,
    error: r.error_text,
  }));
  return { runs, hasMore };
}

/**
 * Sync Now for one source — enqueues through the existing sync_request_job
 * RPC (the SYNC NOW mechanism E2 designed). The queue carries generic jobs,
 * so this is honest: it queues a full pull, not a source-scoped one.
 */
export async function requestSourceSync(
  childId: string,
  source: string,
): Promise<{ job: { id: string; status: string }; source: string; note: string }> {
  const { job } = await requestSync(childId);
  return {
    job: { id: job.id, status: job.status },
    source,
    note: `Sync queued for ${source} — the worker picks it up within a few minutes. The queue runs full pulls, so every source refreshes.`,
  };
}

/** Distinct sources seen in school_sync_runs — powers the console filter. */
export async function getRunSources(childId: string): Promise<{ sources: string[] }> {
  // Missing service key or missing school_sync_runs (066 not migrated)
  // → 503 SERVICE_NOT_READY, never a 500.
  try {
    const { data, error } = await supabaseAdmin
      .from("school_sync_runs")
      .select("source_name")
      .eq("child_id", childId)
      .order("source_name");
    if (error) throw error;
    const seen = new Set<string>();
    for (const r of (data ?? []) as Array<{ source_name: string }>) {
      if (r.source_name) seen.add(r.source_name);
    }
    return { sources: [...seen].sort() };
  } catch (err) {
    guardServiceError(err);
  }
}
