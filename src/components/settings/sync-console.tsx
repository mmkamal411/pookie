"use client";

// Sync console — live sync queue for one child.
// Backend contract (services/sync.ts):
// GET .../children/[childId]/sync/requests?limit=20 → { data: { jobs: SyncJob[] } }
// POST .../children/[childId]/sync/requests → { data: { job: { id, status } } }
// A job's errors[] is extracted server-side from its log; claimed_at is the
// "started" timestamp (no started_at column exists).

import { useCallback, useEffect, useState } from "react";
import { listSyncJobs, triggerSync, ManagementApiError, type SyncJob, type SyncJobStatus } from "@/lib/management-api";
import { demoSyncJobs } from "@/lib/management-demo";
import { SettingsCard, PrimaryButton, BackendPending } from "./settings-ui";

const STATUS_STYLE: Record<SyncJobStatus, { dot: string; label: string }> = {
  pending: { dot: "bg-amber-300", label: "Queued" },
  running: { dot: "bg-sky-300", label: "Running" },
  complete: { dot: "bg-emerald-300", label: "Complete" },
  failed: { dot: "bg-rose-400", label: "Failed" },
};

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function latestJob(jobs: SyncJob[]): SyncJob | null {
  return jobs.length ? jobs[0] : null;
}

export function SyncConsole({ childId, demo }: { childId: string; demo: boolean }) {
  const [jobs, setJobs] = useState<SyncJob[]>(demo ? demoSyncJobs : []);
  const [pending, setPending] = useState(!demo);
  const [loadError, setLoadError] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (demo) return;
    try {
      const { jobs: fresh } = await listSyncJobs(childId);
      setJobs(fresh);
    } catch {
      setLoadError(true);
    } finally {
      setPending(false);
    }
  }, [demo, childId]);

  // Initial load — deferred so setState stays out of the effect body.
  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function syncNow() {
    setTriggering(true);
    setNotice(null);
    try {
      if (demo) {
        setJobs((js) => [
          {
            id: `job-demo-${Date.now()}`,
            status: "pending",
            device: null,
            summary: "Queued by you just now (demo)",
            errors: [],
            created_at: new Date().toISOString(),
            claimed_at: null,
            completed_at: null,
          },
          ...js,
        ]);
      } else {
        const { job } = await triggerSync(childId);
        setNotice(`Sync requested — job ${job.id.slice(0, 8)} is queued. The laptop worker picks it up within a few minutes.`);
        // The new job lands at the top of the list; refresh to show it.
        setTimeout(() => {
          void load();
        }, 1500);
      }
    } catch (e) {
      setNotice(e instanceof ManagementApiError ? e.message : "Couldn't queue the sync.");
    } finally {
      setTriggering(false);
    }
  }

  if (pending) {
    return (
      <div className="space-y-4" aria-label="Loading sync status">
        {[0, 1].map((i) => (
          <div key={i} className="card-living h-40 animate-pulse rounded-3xl" />
        ))}
      </div>
    );
  }
  if (loadError) return <BackendPending feature="Sync console" />;

  const latest = latestJob(jobs);
  const style = latest ? STATUS_STYLE[latest.status] : null;

  return (
    <div className="space-y-4">
      {/* Current status */}
      <SettingsCard title="Sync status">
        {latest && style ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${style.dot} shadow-[0_0_10px_currentColor]`} />
              <span className="text-sm font-semibold text-white">{style.label}</span>
              <span className="text-xs text-white/50">
                · last run {fmtTime(latest.completed_at ?? latest.created_at)}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-white/50">Device</dt>
                <dd className="font-medium text-white/90">{latest.device ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/50">Summary</dt>
                <dd className="font-medium text-white/90">{latest.summary ?? "—"}</dd>
              </div>
            </dl>
            {latest.errors.length > 0 && (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3">
                <p className="text-xs font-semibold text-rose-200">Errors</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-rose-100/90">
                  {latest.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-white/60">No sync runs yet for this child.</p>
        )}
        <div className="mt-4">
          <PrimaryButton onClick={syncNow} disabled={triggering}>
            {triggering ? "Requesting…" : "Sync Now"}
          </PrimaryButton>
          {notice && <p className="mt-2 text-xs text-white/60">{notice}</p>}
        </div>
      </SettingsCard>

      {/* History — last 20 runs */}
      <SettingsCard title="Sync history" description="Newest first.">
        {jobs.length === 0 ? (
          <p className="text-sm text-white/60">No runs recorded yet.</p>
        ) : (
          <ul className="divide-y divide-white/8">
            {jobs.map((job) => {
              const s = STATUS_STYLE[job.status];
              return (
                <li key={job.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white/90">{job.summary ?? "Sync run"}</p>
                        <p className="text-xs text-white/50">
                          {fmtTime(job.completed_at ?? job.created_at)} · {job.device ?? "unknown device"}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-white/60">{s.label}</span>
                  </div>
                  {job.errors.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 pl-4.5">
                      {job.errors.map((err, i) => (
                        <li key={i} className="text-xs text-rose-200/80">
                          ⚠ {err}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>
    </div>
  );
}
