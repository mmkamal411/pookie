"use client";

import Link from "next/link";
import type { Freshness } from "@/lib/school-sync-health-types";

export interface HealthDot {
  source: string;
  name: string;
  freshness: Freshness;
}

const DOT: Record<Freshness, string> = {
  fresh: "bg-comet-400",
  stale: "bg-aurum-400",
  error: "bg-red-400",
  running: "bg-nova-400 animate-pulse",
  never: "bg-stardust-500",
};

const LABEL: Record<Freshness, string> = {
  fresh: "Fresh",
  stale: "Stale",
  error: "Error",
  running: "Running",
  never: "Awaiting First Run",
};

/**
 * Data-freshness summary strip on the school overview — glanceable dots for
 * every source, linking to the mission-control dashboard. Green across the
 * board = peace of mind.
 */
export function SyncHealthSummary({
  sources,
  allGreen,
  childSlug,
}: {
  sources: HealthDot[];
  allGreen: boolean;
  childSlug: string;
}) {
  return (
    <section
      aria-label="Data freshness"
      className="card-living animate-bloom rounded-2xl border border-nova-400/20 px-5 py-4"
      style={{ animationDelay: "0.18s" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-star-100">
            {allGreen && sources.length > 0 ? (
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-comet-400" style={{ boxShadow: "0 0 8px rgb(74 222 128 / 0.8)" }} />
                All Sources Fresh
              </span>
            ) : (
              "Data Freshness"
            )}
          </p>
          <p className="mt-0.5 text-xs text-stardust-300">
            Every school source, one glance — the data behind every number below.
          </p>
        </div>
        <Link
          href={`/c/${childSlug}/school/health`}
          className="shrink-0 rounded-xl border border-nova-400/25 px-3.5 py-2 text-xs font-semibold text-nova-300 transition hover:bg-nova-400/10"
        >
          Mission Control →
        </Link>
      </div>
      {sources.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {sources.map((s) => (
            <span
              key={s.source}
              className="inline-flex items-center gap-1.5 rounded-full border border-nova-400/15 bg-nebula-800/60 px-2.5 py-1 text-[11px] font-medium text-stardust-200"
              title={`${s.name}: ${LABEL[s.freshness]}`}
            >
              <span className={`size-1.5 rounded-full ${DOT[s.freshness]}`} aria-hidden="true" />
              {s.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-stardust-400">
          Pull health reporting starts with the first sync — the workers are being wired up.
        </p>
      )}
    </section>
  );
}
