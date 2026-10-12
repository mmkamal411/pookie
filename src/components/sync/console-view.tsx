"use client";

// Sync tab — the live console. Real run history from school_sync_runs:
// timestamp, source, machine, records, success/failure, duration.
// Terminal aesthetic: monospace log lines, neon accents, gear motifs,
// filterable by source, with per-source Sync Now triggers and the live
// sync_jobs queue underneath.

import { useCallback, useEffect, useMemo, useState } from "react";
import { BackendUnavailable, CommandShell, ConsoleError } from "./command-shell";
import { Gear, StatusLight } from "./gear";
import {
  isServiceNotReady,
  listSyncJobs,
  parseApiError,
  type SyncJob,
} from "@/lib/management-api";

interface SyncRun {
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

const SOURCE_LABEL: Record<string, string> = {
  parentvue: "ParentVUE",
  studentvue: "StudentVUE",
  "ctls-parent": "CTLS Parent",
  "ctls-learn": "CTLS Learn",
  "gmail-teacher": "Teacher Email",
  "ccsd-calendar": "District Calendar",
  "checkin-app": "Check-In App",
};

const SYNC_NOW_SOURCES = ["parentvue", "studentvue", "ctls-parent", "ctls-learn", "gmail-teacher", "ccsd-calendar"];

function sourceLabel(s: string) {
  return SOURCE_LABEL[s] ?? s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDuration(sec: number | null) {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function machineShort(m: string) {
  const d = m.toLowerCase();
  if (d.includes("windows") || d.includes("dashawnalien")) return "WIN";
  if (d.includes("mac")) return "MAC";
  if (d.includes("vm") || d.includes("sandbox")) return "VM";
  return m.slice(0, 8).toUpperCase();
}

function RunLine({ run }: { run: SyncRun }) {
  const [open, setOpen] = useState(false);
  const ok = run.success === true;
  const failed = run.success === false;
  const running = run.finishedAt == null;
  const color = running ? "text-cyan-300" : ok ? "text-emerald-300" : failed ? "text-rose-300" : "text-amber-300";
  const glyph = running ? "◌" : ok ? "✓" : failed ? "✗" : "?";
  const tableEntries = Object.entries(run.tables ?? {});
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2 text-left font-mono text-xs transition hover:bg-white/[0.03] sm:grid-cols-[86px_92px_1fr_auto_auto_auto]"
        aria-expanded={open}
      >
        <span className="text-white/40 tabular-nums">
          {fmtDate(run.startedAt)} {fmtClock(run.startedAt)}
        </span>
        <span className="hidden text-cyan-200/80 sm:inline">{sourceLabel(run.source)}</span>
        <span className={`truncate ${color}`}>
          <span className="mr-1.5">{glyph}</span>
          <span className="sm:hidden">{sourceLabel(run.source)} · </span>
          {running
            ? "running…"
            : failed
              ? (run.error ?? "failed").slice(0, 60)
              : `${run.rowsPulled.toLocaleString()} rows pulled`}
        </span>
        <span className="hidden text-white/40 sm:inline">{machineShort(run.machine)}</span>
        <span className="hidden text-white/40 tabular-nums sm:inline">{fmtDuration(run.durationSec)}</span>
        <span className="text-white/30">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="bg-black/40 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-white/60">
          <p>
            <span className="text-white/35">Run </span>
            <span className="text-white/70">{run.id.slice(0, 8)}</span>
            <span className="text-white/35"> · Source </span>
            <span className="text-cyan-200/80">{sourceLabel(run.source)}</span>
            <span className="text-white/35"> · Machine </span>
            <span className="text-white/70">{run.machine}</span>
          </p>
          {tableEntries.length > 0 && (
            <p className="mt-1">
              <span className="text-white/35">Tables </span>
              {tableEntries.map(([t, n]) => (
                <span key={t} className="mr-2 text-emerald-200/80">
                  {t}: {n.toLocaleString()}
                </span>
              ))}
            </p>
          )}
          {run.error && (
            <p className="mt-1">
              <span className="text-rose-300/70">Error </span>
              <span className="text-rose-200/90">{run.error}</span>
            </p>
          )}
          {running && <p className="mt-1 text-cyan-200/80">Still running — refresh to update.</p>}
        </div>
      )}
    </div>
  );
}

const JOB_STYLE: Record<SyncJob["status"], { color: "amber" | "cyan" | "emerald" | "rose"; label: string }> = {
  pending: { color: "amber", label: "Queued" },
  running: { color: "cyan", label: "Running" },
  complete: { color: "emerald", label: "Complete" },
  failed: { color: "rose", label: "Failed" },
};

export function SyncConsoleView({ childId }: { childId: string }) {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [knownSources, setKnownSources] = useState<string[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // True when the API answers 503 SERVICE_NOT_READY (sync backend not wired
  // up yet) — the console renders the honest unavailable panel and the
  // Sync Now buttons stay disabled instead of dead-ending on a 500.
  const [notReady, setNotReady] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRuns = useCallback(
    async (opts: { append?: boolean; before?: string } = {}) => {
      const params = new URLSearchParams({ limit: "30" });
      if (filter !== "all") params.set("source", filter);
      if (opts.before) params.set("before", opts.before);
      const res = await fetch(`/api/v1/children/${childId}/school/sync-runs?${params}`, { cache: "no-store" });
      if (!res.ok) throw await parseApiError(res);
      const json = (await res.json()) as { data?: { runs: SyncRun[]; hasMore: boolean; sources?: string[] } };
      const fresh = json.data?.runs ?? [];
      setRuns((prev) => (opts.append ? [...prev, ...fresh] : fresh));
      setHasMore(json.data?.hasMore ?? false);
      if (json.data?.sources) setKnownSources(json.data.sources);
    },
    [childId, filter],
  );

  const load = useCallback(async () => {
    setError(null);
    setNotReady(false);
    try {
      const jobsPromise = listSyncJobs(childId, 10);
      await loadRuns();
      const { jobs: freshJobs } = await jobsPromise;
      setJobs(freshJobs);
    } catch (e) {
      setNotReady(isServiceNotReady(e));
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setPending(false);
    }
  }, [childId, loadRuns]);

  useEffect(() => {
    setPending(true);
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  const sources = useMemo(() => {
    const seen = new Set<string>(knownSources);
    for (const r of runs) seen.add(r.source);
    return [...seen].sort();
  }, [runs, knownSources]);

  async function loadMore() {
    if (!runs.length || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadRuns({ append: true, before: runs[runs.length - 1].startedAt });
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }

  async function syncNow(source: string) {
    setSyncing(source);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/sync-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (!res.ok) throw await parseApiError(res);
      const json = (await res.json()) as { data?: { note: string } };
      setNotice(json.data?.note ?? "Sync queued.");
      setTimeout(() => void load(), 2000);
    } catch (e) {
      // A 503 here means the sync backend isn't wired up yet — disable the
      // triggers and say so instead of letting the buttons dead-end.
      if (isServiceNotReady(e)) setNotReady(true);
      setNotice(e instanceof Error ? `Couldn't queue the sync: ${e.message}` : "Couldn't queue the sync.");
    } finally {
      setSyncing(null);
    }
  }

  const activeJobs = jobs.filter((j) => j.status === "pending" || j.status === "running");

  return (
    <CommandShell
      eyebrow="Ship Systems // Live Console"
      title="Sync Console"
      subtitle="Every pull, as it happened. Green is peace of mind."
    >
      {/* Sync Now controls */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-black/40 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] tracking-widest text-cyan-300/70">Trigger Sync</p>
          <p className="text-[11px] text-white/35">
            {notReady
              ? "Sync triggers are unavailable until the sync backend is connected"
              : "Queues a full pull — the worker picks it up within minutes"}
          </p>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {SYNC_NOW_SOURCES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={syncing !== null || notReady}
              onClick={() => void syncNow(s)}
              title={notReady ? "Sync isn't connected yet" : `Queue a sync for ${sourceLabel(s)}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 font-mono text-[11px] text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/20 disabled:opacity-50"
            >
              <Gear active={syncing === s} size={16} glow="text-cyan-300" />
              {syncing === s ? "Queueing…" : sourceLabel(s)}
            </button>
          ))}
        </div>
        {notice && <p className="mt-2.5 font-mono text-[11px] leading-relaxed text-emerald-200/90">▸ {notice}</p>}
      </div>

      {pending ? (
        <div className="h-72 animate-pulse rounded-2xl border border-white/10 bg-white/5" aria-label="Loading console" />
      ) : notReady ? (
        <BackendUnavailable
          message={error ?? "The sync service isn't connected yet."}
          onRetry={() => {
            setPending(true);
            void load();
          }}
        />
      ) : error ? (
        <ConsoleError
          title="Console feed interrupted"
          message={error}
          onRetry={() => {
            setPending(true);
            void load();
          }}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by source">
            {["all", ...sources].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`rounded-full border px-3 py-1 font-mono text-[11px] transition ${
                  filter === s
                    ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
                    : "border-white/10 text-white/50 hover:border-white/25 hover:text-white/80"
                }`}
              >
                {s === "all" ? "All Sources" : sourceLabel(s)}
              </button>
            ))}
          </div>

          {/* Terminal */}
          <div className="overflow-hidden rounded-2xl border border-cyan-300/15 bg-black/70">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
              <span className="ml-2 font-mono text-[11px] text-white/40">sync — live feed</span>
              <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-emerald-300/80">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                Live
              </span>
            </div>
            <div className="max-h-[420px] overflow-y-auto" role="log" aria-label="Sync run history">
              {runs.length === 0 ? (
                <p className="px-4 py-8 text-center font-mono text-xs text-white/40">
                  No runs recorded yet — the workers report here after their first pull.
                </p>
              ) : (
                runs.map((r) => <RunLine key={r.id} run={r} />)
              )}
            </div>
          </div>
          {hasMore && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded-xl border border-white/15 px-4 py-2 font-mono text-xs text-white/70 transition hover:border-white/30 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load Older Runs"}
              </button>
            </div>
          )}

          {/* Queue */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3.5">
            <p className="font-mono text-[11px] tracking-widest text-cyan-300/70">Sync Queue</p>
            {activeJobs.length === 0 ? (
              <p className="mt-1.5 text-xs text-white/45">Queue is empty — nothing waiting on the workers.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {activeJobs.map((j) => {
                  const st = JOB_STYLE[j.status];
                  return (
                    <li key={j.id} className="flex items-center gap-2.5 font-mono text-xs text-white/70">
                      <StatusLight color={st.color} pulse={j.status !== "complete"} />
                      <span className="text-white/85">{st.label}</span>
                      <span className="text-white/35">· job {j.id.slice(0, 8)}</span>
                      {j.summary && <span className="truncate text-white/45">· {j.summary}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
      <p className="mt-4 text-center font-mono text-[11px] text-white/35">
        Auto-refreshes every 20 seconds · History kept 90 days
      </p>
    </CommandShell>
  );
}
