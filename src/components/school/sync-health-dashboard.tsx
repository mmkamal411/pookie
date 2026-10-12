"use client";

import { useState } from "react";
import Link from "next/link";
import { PookieOrb } from "@/components/pookie-orb";
import {
  ageLabel,
  freshnessLabel,
  type Freshness,
  type SourceHealth,
  type SyncHealthSummary as Summary,
} from "@/lib/school-sync-health-types";

const DOT: Record<Freshness, string> = {
  fresh: "bg-comet-400",
  stale: "bg-aurum-400",
  error: "bg-red-400",
  running: "bg-nova-400 animate-pulse",
  never: "bg-stardust-500",
};

const GLOW: Record<Freshness, string> = {
  fresh: "0 0 8px rgb(74 222 128 / 0.8)",
  stale: "0 0 8px rgb(251 191 36 / 0.8)",
  error: "0 0 8px rgb(248 113 113 / 0.8)",
  running: "0 0 8px rgb(96 165 250 / 0.8)",
  never: "none",
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function cadenceLabel(cadence: string | null): string {
  switch (cadence) {
    case "hourly": return "Every hour";
    case "daily": return "Daily";
    case "weekly": return "Weekly";
    case "manual": return "Manual";
    default: return cadence ?? "—";
  }
}

function SourceCard({ source, index }: { source: SourceHealth; index: number }) {
  const [open, setOpen] = useState(source.freshness === "error");
  return (
    <div
      className="card-living animate-bloom overflow-hidden rounded-2xl border border-nova-400/15"
      style={{ animationDelay: `${0.08 + index * 0.05}s` }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <span
          className={`size-3 shrink-0 rounded-full ${DOT[source.freshness]}`}
          style={{ boxShadow: GLOW[source.freshness] }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-star-100">{source.name}</span>
          <span className="mt-0.5 block truncate text-xs text-stardust-300">{source.description}</span>
        </span>
        <span className="hidden shrink-0 text-right sm:block">
          <span className="block text-xs font-medium text-stardust-200">
            {source.lastSuccessAt ? `Fresh as of ${fmtDateTime(source.lastSuccessAt)}` : ageLabel(source.ageMinutes)}
          </span>
          <span className="mt-0.5 block text-[11px] text-stardust-400">
            {source.nextScheduledRun ? `Next run ${fmtDateTime(source.nextScheduledRun)}` : cadenceLabel(source.cadence)}
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-nova-400/20 px-2.5 py-1 text-[11px] font-semibold text-stardust-200">
          {freshnessLabel(source.freshness)}
        </span>
        <span aria-hidden="true" className={`shrink-0 text-stardust-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      <div className="grid transition-[grid-template-rows] duration-200 ease-in-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="border-t border-nova-400/10 px-5 py-4">
            {/* Key stats */}
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-nebula-800/60 px-3 py-2.5">
                <dt className="text-[10px] font-semibold tracking-widest text-stardust-400 capitalize">Last Run</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-star-100">{fmtDateTime(source.lastRunFinished)}</dd>
              </div>
              <div className="rounded-xl bg-nebula-800/60 px-3 py-2.5">
                <dt className="text-[10px] font-semibold tracking-widest text-stardust-400 capitalize">Rows Pulled</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-star-100">{source.rowsPulled.toLocaleString()}</dd>
              </div>
              <div className="rounded-xl bg-nebula-800/60 px-3 py-2.5">
                <dt className="text-[10px] font-semibold tracking-widest text-stardust-400 capitalize">Freshness Age</dt>
                <dd className="mt-0.5 text-sm font-semibold text-star-100">{ageLabel(source.ageMinutes)}</dd>
              </div>
              <div className="rounded-xl bg-nebula-800/60 px-3 py-2.5">
                <dt className="text-[10px] font-semibold tracking-widest text-stardust-400 capitalize">Cadence</dt>
                <dd className="mt-0.5 text-sm font-semibold text-star-100">{cadenceLabel(source.cadence)}</dd>
              </div>
            </dl>

            {/* Rows by table */}
            {Object.keys(source.rowsByTable).length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold tracking-widest text-stardust-400 capitalize">Rows by Table</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(source.rowsByTable).map(([table, count]) => (
                    <span key={table} className="rounded-full bg-nebula-800/60 px-2.5 py-1 text-[11px] tabular-nums text-stardust-200">
                      {table} · {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Machines */}
            {source.machines.length > 1 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold tracking-widest text-stardust-400 capitalize">Machines</p>
                <div className="mt-1.5 space-y-1.5">
                  {source.machines.map((m) => (
                    <div key={m.machine} className="flex items-center gap-2.5 text-xs">
                      <span className={`size-1.5 rounded-full ${DOT[m.freshness]}`} aria-hidden="true" />
                      <span className="font-medium text-stardust-200 capitalize">{m.machine}</span>
                      <span className="text-stardust-400">
                        {m.lastSuccessAt ? fmtDateTime(m.lastSuccessAt) : "never"} · {m.rowsPulled} rows
                        {m.consecutiveErrors > 0 && <span className="text-red-300"> · {m.consecutiveErrors} errors</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last error */}
            {source.lastError && (
              <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/5 px-3.5 py-2.5">
                <p className="text-[10px] font-semibold tracking-widest text-red-300 capitalize">Last Error</p>
                <p className="mt-1 text-xs leading-relaxed text-red-200">{source.lastError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Mission-control pull-health dashboard. Glanceable: green across the
 * board = peace of mind. Auto-refreshes every 60s.
 */
export function SyncHealthDashboard({
  initial,
  childSlug,
  childName,
}: {
  initial: Summary;
  childSlug: string;
  childName: string;
}) {
  const [data] = useState<Summary>(initial);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      // Server-rendered page: a full reload pulls the recomputed summary
      // (the service re-runs recompute_school_sync_health on every read).
      window.location.reload();
    } finally {
      setRefreshing(false);
    }
  }

  const counts = {
    fresh: data.sources.filter((s) => s.freshness === "fresh").length,
    stale: data.sources.filter((s) => s.freshness === "stale").length,
    error: data.sources.filter((s) => s.freshness === "error").length,
    never: data.sources.filter((s) => s.freshness === "never").length,
    running: data.sources.filter((s) => s.freshness === "running").length,
  };

  return (
    <main className="relative mx-auto max-w-5xl px-4 py-10">
      <div className="firefly" style={{ width: 8, height: 8, top: "8%", left: "12%" }} />
      <div className="firefly" style={{ width: 6, height: 6, top: "30%", left: "88%", animationDelay: "1.6s" }} />

      <Link href={`/c/${childSlug}/school`} className="animate-bloom text-sm font-medium text-nova-300 hover:text-nova-400">
        ← School Overview
      </Link>

      <div className="animate-bloom mt-4 flex items-center gap-4">
        <PookieOrb size={56} />
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-nova-400 capitalize">
            School · Mission Control
          </p>
          <h1 className="text-sunlit mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Data Freshness
          </h1>
        </div>
      </div>

      <p className="animate-bloom mt-3 max-w-xl leading-relaxed text-stardust-300" style={{ animationDelay: "0.08s" }}>
        Every source feeding {childName}&apos;s school pages, watched around the clock.
        Green across the board means the numbers below are fresh — no thinking required.
      </p>

      {/* Status banner */}
      <div
        className="animate-bloom mt-6 rounded-2xl border px-5 py-4"
        style={{
          animationDelay: "0.12s",
          borderColor: data.allGreen && data.sources.length > 0 ? "rgb(74 222 128 / 0.3)" : "rgb(96 165 250 / 0.25)",
          background: data.allGreen && data.sources.length > 0 ? "rgb(74 222 128 / 0.06)" : "rgb(96 165 250 / 0.05)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`size-3 rounded-full ${data.allGreen && data.sources.length > 0 ? "bg-comet-400" : "bg-nova-400"}`}
              style={{ boxShadow: data.allGreen && data.sources.length > 0 ? "0 0 10px rgb(74 222 128 / 0.9)" : "0 0 10px rgb(96 165 250 / 0.9)" }}
              aria-hidden="true" />
            <p className="text-sm font-semibold text-star-100">
              {data.allGreen && data.sources.length > 0
                ? "All Sources Fresh — the data is good."
                : data.sources.length === 0
                  ? "Health Reporting Not Wired Yet"
                  : `${counts.error > 0 ? `${counts.error} source${counts.error > 1 ? "s" : ""} in error · ` : ""}${counts.stale} stale · ${counts.fresh} fresh${counts.never > 0 ? ` · ${counts.never} awaiting first run` : ""}`}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="rounded-xl border border-nova-400/25 px-4 py-2 text-xs font-semibold text-nova-300 transition hover:bg-nova-400/10 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-stardust-400">
          Checked {fmtDateTime(data.checkedAt)}
          {data.recomputed ? " · freshness recomputed just now" : ""}
        </p>
      </div>

      {/* Source cards */}
      <div className="mt-6 space-y-3">
        {data.sources.map((s, i) => (
          <SourceCard key={s.source} source={s} index={i} />
        ))}
      </div>

      {data.sources.length === 0 && (
        <div className="card-living awaiting-data mt-6 rounded-2xl px-5 py-8 text-center">
          <p className="instrument-label">Health Telemetry Wiring Up</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-stardust-200">
            The pull workers haven&apos;t reported in yet. The moment the first
            health heartbeat lands, this board lights up green — until then,
            grades on the school pages come from the last successful sync.
          </p>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-stardust-500">
        Freshness recomputes on every visit · per-run history retains 90 days
      </p>
    </main>
  );
}
