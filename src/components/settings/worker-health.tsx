"use client";

// Agent heartbeats — worker liveness cards for one child.
// Backend contract (services/sync.ts):
// GET .../children/[childId]/sync/heartbeats → { data: { workers: WorkerHeartbeat[] } }
// Health bands derive client-side from last_seen: green <1h · yellow 1–12h · red >12h.
// version / last_error are null until migration 014 (rendered as "—").

import { useEffect, useState } from "react";
import {
  listHeartbeats,
  heartbeatHealth,
  type WorkerHeartbeat,
} from "@/lib/management-api";
import { demoHeartbeats } from "@/lib/management-demo";
import { SettingsCard, BackendPending } from "./settings-ui";

const HEALTH_STYLE = {
  green: { dot: "bg-emerald-300", ring: "border-emerald-300/25", text: "Online" },
  yellow: { dot: "bg-amber-300", ring: "border-amber-300/25", text: "Stale" },
  red: { dot: "bg-rose-400", ring: "border-rose-400/25", text: "Offline" },
} as const;

function fmtTime(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function WorkerCard({ worker }: { worker: WorkerHeartbeat }) {
  const health = heartbeatHealth(worker.last_seen);
  const style = HEALTH_STYLE[health];
  return (
    <div className={`card-living rounded-3xl border p-4 ${style.ring}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`h-3 w-3 rounded-full ${style.dot} shadow-[0_0_12px_currentColor]`} />
          <div>
            <p className="text-sm font-semibold text-white">{worker.worker_id}</p>
            <p className="text-xs text-white/50">{style.text}</p>
          </div>
        </div>
        {worker.is_stale && (
          <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-xs font-medium text-amber-200">
            stale
          </span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2.5 text-sm">
        <div>
          <dt className="text-xs text-white/50">Last heartbeat</dt>
          <dd className="font-medium text-white/90">{fmtTime(worker.last_seen)}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/50">Last successful sync</dt>
          <dd className="font-medium text-white/90">{fmtTime(worker.last_successful_sync_at)}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/50">Version</dt>
          <dd className="font-medium text-white/90">{worker.version ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/50">Worker status</dt>
          <dd className="font-medium text-white/90">{worker.status}</dd>
        </div>
      </dl>
      {worker.last_error && (
        <p className="mt-2.5 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-2.5 text-xs text-rose-100/90">
          ⚠ {worker.last_error}
        </p>
      )}
    </div>
  );
}

export function WorkerHealthView({ childId, demo }: { childId: string; demo: boolean }) {
  const [workers, setWorkers] = useState<WorkerHeartbeat[]>(demo ? demoHeartbeats : []);
  const [pending, setPending] = useState(!demo);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    (async () => {
      try {
        const { workers: fresh } = await listHeartbeats(childId);
        if (!cancelled) setWorkers(fresh);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, childId]);

  if (pending) {
    return (
      <div className="space-y-4" aria-label="Loading worker health">
        {[0, 1].map((i) => (
          <div key={i} className="card-living h-44 animate-pulse rounded-3xl" />
        ))}
      </div>
    );
  }
  if (loadError) return <BackendPending feature="Agent heartbeats" />;

  return (
    <SettingsCard
      title="Agent heartbeats"
      description="Green: beat in the last hour · Yellow: 1–12 hours · Red: over 12 hours."
    >
      {workers.length === 0 ? (
        <p className="text-sm text-white/60">No workers have reported for this child yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {workers.map((w) => (
            <WorkerCard key={w.worker_id} worker={w} />
          ))}
        </div>
      )}
    </SettingsCard>
  );
}
