// Pull-health mission control — one status row per school data source.
// Reads E4's school_sync_health table (066_school_telemetry.sql); when the
// table is missing/empty it degrades gracefully to sync_heartbeats +
// "Awaiting First Run" instead of erroring (NO BLANK PAGES — EVER).
// Freshness is recomputed server-side via recompute_school_sync_health().

import { createClient } from "@/lib/supabase/server";

export type Freshness = "fresh" | "stale" | "error" | "running" | "never";

export interface MachineHealth {
  machine: string;
  freshness: Freshness;
  lastRunFinished: string | null;
  lastSuccessAt: string | null;
  nextScheduledRun: string | null;
  rowsPulled: number;
  rowsByTable: Record<string, number>;
  lastError: string | null;
  consecutiveErrors: number;
  ageMinutes: number | null;
}

export interface SourceHealth {
  source: string;
  name: string;
  description: string;
  freshness: Freshness;
  machines: MachineHealth[];
  lastRunFinished: string | null;
  lastSuccessAt: string | null;
  nextScheduledRun: string | null;
  rowsPulled: number;
  rowsByTable: Record<string, number>;
  lastError: string | null;
  consecutiveErrors: number;
  cadence: string | null;
  ageMinutes: number | null;
}

export interface SyncHealthSummary {
  sources: SourceHealth[];
  allGreen: boolean;
  checkedAt: string;
  recomputed: boolean;
}

export const SOURCE_META: Record<string, { name: string; description: string }> = {
  studentvue: { name: "StudentVUE", description: "Student gradebook detail + category weights" },
  parentvue: { name: "ParentVUE", description: "Parent grades + attendance pull" },
  "gmail-teacher": { name: "Teacher Emails", description: "Teacher + counselor email pull" },
  "ctls-learn": { name: "CTLS Learn", description: "Curriculum materials + upcoming work" },
  "ctls-parent": { name: "CTLS Parent", description: "Class schedule + announcements" },
  "ccsd-calendar": { name: "District Calendar", description: "CCSD calendar events ingest" },
  "checkin-app": { name: "Check-In App", description: "Daily check-in data bridge" },
};

const SOURCE_ORDER = [
  "studentvue",
  "parentvue",
  "ctls-learn",
  "ctls-parent",
  "gmail-teacher",
  "ccsd-calendar",
  "checkin-app",
];

const FRESHNESS_RANK: Record<Freshness, number> = {
  error: 0,
  stale: 1,
  never: 2,
  running: 3,
  fresh: 4,
};

type HealthRow = {
  source_name: string;
  machine: string;
  cadence: string | null;
  expected_freshness: string | null;
  last_run_started: string | null;
  last_run_finished: string | null;
  last_success_at: string | null;
  rows_pulled: number;
  rows_by_table: Record<string, number> | null;
  error_text: string | null;
  consecutive_errors: number;
  next_scheduled_run: string | null;
  data_freshness_status: string;
};

function toMachine(row: HealthRow): MachineHealth {
  const freshness = ((): Freshness => {
    const s = row.data_freshness_status;
    if (s === "fresh" || s === "stale" || s === "error" || s === "never") return s;
    return "never";
  })();
  const lastSuccessAt = row.last_success_at ?? null;
  return {
    machine: row.machine,
    freshness,
    lastRunFinished: row.last_run_finished ?? null,
    lastSuccessAt,
    nextScheduledRun: row.next_scheduled_run ?? null,
    rowsPulled: row.rows_pulled ?? 0,
    rowsByTable: row.rows_by_table ?? {},
    lastError: row.error_text ?? null,
    consecutiveErrors: row.consecutive_errors ?? 0,
    ageMinutes:
      lastSuccessAt != null
        ? Math.max(0, Math.round((Date.now() - new Date(lastSuccessAt).getTime()) / 60000))
        : null,
  };
}

/** Merge one source's machine rows into a single display row. */
function aggregate(source: string, rows: HealthRow[]): SourceHealth {
  const meta = SOURCE_META[source] ?? { name: source, description: "" };
  const machines = rows.map(toMachine);
  // Worst freshness wins (error > stale > never > running > fresh).
  const worst = machines.reduce((a, b) =>
    FRESHNESS_RANK[a.freshness] <= FRESHNESS_RANK[b.freshness] ? a : b
  );
  const freshest = machines
    .filter((m) => m.ageMinutes != null)
    .sort((a, b) => (a.ageMinutes as number) - (b.ageMinutes as number))[0];
  const recentError = machines
    .filter((m) => m.lastError)
    .sort((a, b) =>
      new Date(b.lastRunFinished ?? 0).getTime() - new Date(a.lastRunFinished ?? 0).getTime()
    )[0];
  const lastFinished = machines
    .map((m) => m.lastRunFinished)
    .filter((d): d is string => !!d)
    .sort()
    .pop() ?? null;
  const rowsByTable: Record<string, number> = {};
  for (const m of machines) {
    for (const [k, v] of Object.entries(m.rowsByTable)) {
      rowsByTable[k] = (rowsByTable[k] ?? 0) + (typeof v === "number" ? v : 0);
    }
  }
  return {
    source,
    name: meta.name,
    description: meta.description,
    freshness: worst.freshness,
    machines,
    lastRunFinished: lastFinished,
    lastSuccessAt: freshest?.lastSuccessAt ?? null,
    nextScheduledRun: machines.map((m) => m.nextScheduledRun).filter((d): d is string => !!d).sort().pop() ?? null,
    rowsPulled: machines.reduce((s, m) => s + m.rowsPulled, 0),
    rowsByTable,
    lastError: recentError?.lastError ?? null,
    consecutiveErrors: Math.max(0, ...machines.map((m) => m.consecutiveErrors)),
    cadence: rows[0]?.cadence ?? null,
    ageMinutes: freshest?.ageMinutes ?? null,
  };
}

function neverRow(source: string): SourceHealth {
  const meta = SOURCE_META[source] ?? { name: source, description: "" };
  return {
    source,
    name: meta.name,
    description: meta.description,
    freshness: "never",
    machines: [],
    lastRunFinished: null,
    lastSuccessAt: null,
    nextScheduledRun: null,
    rowsPulled: 0,
    rowsByTable: {},
    lastError: null,
    consecutiveErrors: 0,
    cadence: null,
    ageMinutes: null,
  };
}

/**
 * Read per-source pull health. Fail-closed is the service contract —
 * failures return "never" rows for every source, never a throw.
 */
export async function getSyncHealth(childId: string): Promise<SyncHealthSummary> {
  const checkedAt = new Date().toISOString();
  let recomputed = false;
  const neverRows = SOURCE_ORDER.map(neverRow);
  try {
    const supabase = await createClient();

    // Flip 'stale' without waiting for the next sync (E4's RPC, authenticated-granted).
    try {
      await supabase.rpc("recompute_school_sync_health", { p_child_id: childId });
      recomputed = true;
    } catch {
      // RPC missing or denied — read rows as-is.
    }

    const { data, error } = await supabase
      .from("school_sync_health")
      .select(
        "source_name, machine, cadence, expected_freshness, last_run_started, last_run_finished, " +
          "last_success_at, rows_pulled, rows_by_table, error_text, consecutive_errors, " +
          "next_scheduled_run, data_freshness_status"
      )
      .eq("child_id", childId);
    if (error) {
      // Table missing (migration 066 not applied yet) — degrade to heartbeats.
      return await heartbeatFallback(childId, checkedAt);
    }
    const rows = (data ?? []) as unknown as HealthRow[];
    const bySource = new Map<string, HealthRow[]>();
    for (const r of rows) {
      const list = bySource.get(r.source_name) ?? [];
      list.push(r);
      bySource.set(r.source_name, list);
    }
    const ordered = [...SOURCE_ORDER.filter((s) => bySource.has(s)),
      ...[...bySource.keys()].filter((s) => !SOURCE_ORDER.includes(s)).sort()];
    const sources = ordered.map((s) => aggregate(s, bySource.get(s) as HealthRow[]));
    const allGreen = sources.length > 0 && sources.every((s) => s.freshness === "fresh");
    return { sources, allGreen, checkedAt, recomputed };
  } catch {
    return { sources: neverRows, allGreen: false, checkedAt, recomputed };
  }
}

/** Fallback: derive worker liveness from sync_heartbeats so the page still shows something real. */
async function heartbeatFallback(childId: string, checkedAt: string): Promise<SyncHealthSummary> {
  const sources = SOURCE_ORDER.slice(0, 6).map(neverRow);
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("sync_heartbeats")
      .select("device_name, status, last_heartbeat")
      .eq("child_id", childId)
      .order("last_heartbeat", { ascending: false })
      .limit(5);
    const beats = (data ?? []) as Array<{ device_name: string; status: string; last_heartbeat: string }>;
    if (beats.length > 0) {
      const last = beats[0];
      const alive = Date.now() - new Date(last.last_heartbeat).getTime() < 36 * 3600 * 1000;
      if (alive) {
        for (const s of sources) {
          if (s.source === "studentvue" || s.source === "parentvue") {
            s.freshness = "stale";
            s.lastRunFinished = last.last_heartbeat;
            s.description += ` · worker ${last.device_name} seen recently (per-source health not reporting yet)`;
          }
        }
      }
    }
  } catch {
    // never rows already cover it
  }
  return { sources, allGreen: false, checkedAt, recomputed: false };
}

/** Human age: "5 min ago" / "2 h ago" / "3 d ago". */
export function ageLabel(ageMinutes: number | null): string {
  if (ageMinutes == null) return "Never pulled";
  if (ageMinutes < 1) return "Just now";
  if (ageMinutes < 60) return `${ageMinutes} min ago`;
  const hours = Math.floor(ageMinutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export function freshnessLabel(f: Freshness): string {
  switch (f) {
    case "fresh": return "Fresh";
    case "stale": return "Stale";
    case "error": return "Error";
    case "running": return "Running";
    case "never": return "Awaiting First Run";
  }
}
