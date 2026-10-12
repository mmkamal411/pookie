"use client";

import Link from "next/link";
import { TaskBoard } from "@/components/tasks/task-board";
import { BillBoard } from "@/components/bills/bill-board";
import { MorningBriefing } from "@/components/morning-briefing";
import type { SchoolOverview } from "@/lib/school/types";
import { dueDateLabel } from "@/components/school/styles";
import { byUrgency, daysUntil, statusStyle } from "@/components/overview/due-helpers";

/**
 * Today tab — the day's schedule and tasks.
 * Due today, tonight's top 3, the check-in nudge. One glance, then go.
 *
 * Mission Critical Spacecraft skin: HUD panels with corner brackets,
 * semantic status accents (cyan active, amber pending, green done, red overdue),
 * monospace data readouts, no lavender, no pill radii.
 */

function statusAccent(status: string): string {
  // Missing/late = overdue (red); everything else on the radar is active (cyan).
  return status === "missing" || status === "late" ? "hull-red" : "hull-cyan";
}

function statusColor(status: string): string {
  return status === "missing" || status === "late" ? "text-neon-red" : "text-neon-cyan";
}

/** Tonight's priorities accent: overdue goes red, everything else is pending amber. */
function priorityAccent(status: string): string {
  return status === "missing" || status === "late" ? "hull-red" : "hull-amber";
}

export function TodayView({
  overview,
  childName,
  childSlug,
}: {
  overview: SchoolOverview;
  childName: string;
  childSlug: string;
}) {
  const dueToday = overview.due_next.filter((d) => {
    if (d.status === "missing" || d.status === "late") return true;
    return daysUntil(d.due_date) === 0;
  });
  const tonight = [...overview.due_next].sort(byUrgency).slice(0, 3);

  return (
    <main className="relative mx-auto max-w-3xl px-4 pt-10 pb-8">
      <p className="hull-title animate-bloom">Today · Flight Plan</p>
      <h1
        className="animate-bloom mt-3 text-3xl font-semibold tracking-tight text-hull-text"
        style={{ animationDelay: "0.08s" }}
      >
        Today&apos;s Flight Plan for {childName}
      </h1>
      <p className="hull-readout animate-bloom mt-2 text-xs text-hull-text-dim" style={{ animationDelay: "0.12s" }}>
        {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}
      </p>

      <MorningBriefing schoolDueCount={dueToday.length} checkinDone={!!overview.checkin_today} />

      {!overview.checkin_today && (
        <Link
          href={`/c/${childSlug}/school#checkin`}
          className="hull-panel hull-amber hull-panel-accent animate-bloom mt-6 block px-5 py-4"
          style={{ animationDelay: "0.16s" }}
        >
          <p className="text-sm font-medium text-hull-text">Today&apos;s Check-In Isn&apos;t Logged Yet</p>
          <p className="mt-1 text-sm text-hull-text-dim">Two minutes — how did the mission go today? →</p>
        </Link>
      )}

      <h2 className="hull-title animate-bloom mt-8" style={{ animationDelay: "0.2s" }}>
        On the Radar Today
      </h2>
      <div className="mt-3 grid gap-3">
        {dueToday.length === 0 ? (
          <p className="animate-bloom text-sm text-hull-text-dim" style={{ animationDelay: "0.22s" }}>
            Nothing on the radar — all clear.
          </p>
        ) : (
          dueToday.map((item, i) => {
            const s = statusStyle(item.status);
            return (
              <Link
                key={item.id}
                href={`/c/${childSlug}/school/${item.class_slug}`}
                className={`hull-panel hull-panel-accent animate-bloom flex items-center justify-between gap-3 px-5 py-4 ${statusAccent(item.status)}`}
                style={{ animationDelay: `${0.22 + i * 0.05}s` }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-hull-text">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-hull-text-dim">
                    {item.class_name}
                    {item.category ? ` · ${item.category}` : ""}
                  </p>
                </div>
                <p className={`hull-readout shrink-0 text-xs font-medium ${statusColor(item.status)}`}>
                  {item.status === "missing" || item.status === "late" ? s.label : dueDateLabel(item.due_date)}
                </p>
              </Link>
            );
          })
        )}
      </div>

      <h2 className="hull-title animate-bloom mt-8" style={{ animationDelay: "0.28s" }}>
        Tonight&apos;s Flight Priorities
      </h2>
      <div className="mt-3 grid gap-3">
        {tonight.length === 0 ? (
          <p className="animate-bloom text-sm text-hull-text-dim" style={{ animationDelay: "0.3s" }}>
            The evening is yours — no priority maneuvers on the board.
          </p>
        ) : (
          tonight.map((item, i) => {
            const s = statusStyle(item.status);
            return (
              <div
                key={item.id}
                className={`hull-panel hull-panel-accent animate-bloom flex items-center gap-4 px-5 py-4 ${priorityAccent(item.status)}`}
                style={{ animationDelay: `${0.3 + i * 0.05}s` }}
              >
                <span
                  className="hull-readout flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-neon-cyan/30 text-sm font-bold text-neon-cyan"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-hull-text">{item.title}</p>
                  <p className="hull-readout mt-0.5 truncate text-xs text-hull-text-dim">
                    {item.class_name} · {item.status === "missing" || item.status === "late" ? s.label.split(" — ")[0] : dueDateLabel(item.due_date)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="animate-bloom mt-8" style={{ animationDelay: "0.34s" }}>
        <TaskBoard compact />
      </div>

      <div className="animate-bloom mt-8" style={{ animationDelay: "0.35s" }}>
        <BillBoard compact />
      </div>

      <Link
        href={`/c/${childSlug}/school`}
        className="hull-btn animate-bloom mt-8 inline-block px-4 py-2"
        style={{ animationDelay: "0.36s" }}
      >
        Open the School Console
      </Link>
    </main>
  );
}
