"use client";

import { useState } from "react";
import { BELL_SCHEDULE_SOURCE, WALTON_DAILY, WALTON_WEB, type BellRow } from "@/lib/school/bell-schedules";
import { Collapsible } from "./collapsible";

function ScheduleTable({ rows }: { rows: BellRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-nova-400/15">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-nebula-800 text-left">
            <th className="px-3 py-2 font-semibold text-star-100">Period</th>
            <th className="px-3 py-2 font-semibold text-star-100">Start</th>
            <th className="px-3 py-2 font-semibold text-star-100">End</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.period} className={i % 2 === 0 ? "bg-nebula-900/60" : "bg-nebula-800/40"}>
              <td className="px-3 py-2 font-semibold text-star-100">{r.period}</td>
              <td className="px-3 py-2 tabular-nums text-stardust-200">{r.start}</td>
              <td className="px-3 py-2 tabular-nums text-stardust-200">{r.end}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Walton HS bell schedules — collapsed by default, Daily / WEB Days tabs. */
export function BellSchedule() {
  const [tab, setTab] = useState<"daily" | "web">("daily");

  return (
    <Collapsible title="Walton HS Bell Schedules" subtitle="Tap a schedule to expand">
      <div className="mb-3 flex gap-2">
        {(["daily", "web"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t
                ? "bg-nova-400/25 text-star-100 ring-1 ring-nova-400/50"
                : "bg-nebula-800/60 text-stardust-300 hover:bg-nebula-700/60"
            }`}
          >
            {t === "daily" ? "Daily" : "WEB Days"}
          </button>
        ))}
      </div>
      {tab === "web" && (
        <p className="mb-3 text-xs text-stardust-300">
          Shortened periods with A–E enrichment blocks in the afternoon.
        </p>
      )}
      <ScheduleTable rows={tab === "daily" ? WALTON_DAILY : WALTON_WEB} />
      <a
        href={BELL_SCHEDULE_SOURCE}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-xs font-medium text-nova-300 hover:underline"
      >
        Source: cobbk12.org ↗
      </a>
    </Collapsible>
  );
}
