"use client";

// Workers tab — the fleet. WIN and MAC cards with neon status indicators,
// last heartbeat, responsibilities, and gears that spin while syncing.
// Silent workers are honest: "Awaiting First Contact", never mock data.

import { useCallback, useEffect, useState } from "react";
import { BackendUnavailable, CommandShell, ConsoleError } from "./command-shell";
import { Gear, StatusLight } from "./gear";
import { isServiceNotReady, parseApiError } from "@/lib/management-api";

interface FleetWorker {
  key: string;
  device: string;
  title: string;
  subtitle: string;
  responsibilities: string[];
  note: string;
  status: "online" | "stale" | "offline" | "never";
  lastSeen: string | null;
  lastSuccessAt: string | null;
  syncingNow: boolean;
  workerStatus: string | null;
}

const STATUS_META = {
  online: { color: "emerald", label: "Online" },
  stale: { color: "amber", label: "Stale" },
  offline: { color: "rose", label: "Offline" },
  never: { color: "slate", label: "Awaiting First Contact" },
} as const;

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ageLabel(iso: string | null) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function WorkerCard({ worker }: { worker: FleetWorker }) {
  const meta = STATUS_META[worker.status];
  const border =
    worker.status === "online"
      ? "border-emerald-300/30 shadow-[0_0_30px_rgba(52,211,153,0.10)]"
      : worker.status === "stale"
        ? "border-amber-300/30 shadow-[0_0_30px_rgba(252,211,77,0.08)]"
        : worker.status === "offline"
          ? "border-rose-400/30"
          : "border-white/10";
  return (
    <article className={`relative overflow-hidden rounded-2xl border bg-black/50 p-5 ${border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Gear active={worker.syncingNow} size={52} glow={worker.syncingNow ? "text-cyan-300" : "text-white/40"} />
          <div>
            <h3 className="font-mono text-2xl font-bold tracking-widest text-white">{worker.title}</h3>
            <p className="text-xs text-white/50">{worker.subtitle}</p>
          </div>
        </div>
        <StatusLight color={meta.color} pulse={worker.status === "online" || worker.syncingNow} label={meta.label} />
      </div>

      {worker.syncingNow && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 font-mono text-[11px] text-cyan-200">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-cyan-300" />
          Sync in progress
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-xs">
        <div>
          <dt className="text-white/40">Last Heartbeat</dt>
          <dd className="mt-0.5 text-sm text-white/90">{fmtTime(worker.lastSeen)}</dd>
          <dd className="text-white/40">{ageLabel(worker.lastSeen)}</dd>
        </div>
        <div>
          <dt className="text-white/40">Last Successful Sync</dt>
          <dd className="mt-0.5 text-sm text-white/90">{fmtTime(worker.lastSuccessAt)}</dd>
          <dd className="text-white/40">{ageLabel(worker.lastSuccessAt)}</dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="font-mono text-[11px] tracking-widest text-cyan-300/70">Responsibilities</p>
        <ul className="mt-1.5 space-y-1">
          {worker.responsibilities.map((r) => (
            <li key={r} className="flex items-center gap-2 text-xs text-white/70">
              <span className="h-1 w-1 rounded-full bg-cyan-300/70" />
              {r}
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[11px] leading-relaxed text-white/40">{worker.note}</p>
      </div>
    </article>
  );
}

export function WorkersView({ childId }: { childId: string }) {
  const [workers, setWorkers] = useState<FleetWorker[]>([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 503 SERVICE_NOT_READY (fleet backend not wired up yet) — honest
  // unavailable panel instead of an error loop.
  const [notReady, setNotReady] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setNotReady(false);
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/workers`, { cache: "no-store" });
      if (!res.ok) throw await parseApiError(res);
      const json = (await res.json()) as { data?: { workers: FleetWorker[] } };
      setWorkers(json.data?.workers ?? []);
    } catch (e) {
      setNotReady(isServiceNotReady(e));
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setPending(false);
    }
  }, [childId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <CommandShell
      eyebrow="Ship Systems // Fleet Status"
      title="Sync Fleet"
      subtitle="Two machines pull the school data. This is their live status."
    >
      {pending ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-label="Loading fleet status">
          {[0, 1].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : notReady ? (
        <BackendUnavailable
          message={error ?? "The fleet monitor isn't connected yet."}
          onRetry={() => {
            setPending(true);
            void load();
          }}
        />
      ) : error ? (
        <ConsoleError
          title="Couldn't reach the fleet monitor"
          message={error}
          onRetry={() => {
            setPending(true);
            void load();
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {workers.map((w) => (
            <WorkerCard key={w.key} worker={w} />
          ))}
        </div>
      )}
      <p className="mt-4 text-center font-mono text-[11px] text-white/35">
        Auto-refreshes every 30 seconds · Heartbeats come from the workers themselves
      </p>
    </CommandShell>
  );
}
