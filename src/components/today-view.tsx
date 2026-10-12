"use client";

import Link from "next/link";
import { PookieOrb } from "@/components/pookie-orb";
import { TaskBoard } from "@/components/tasks/task-board";
import { BillBoard } from "@/components/bills/bill-board";
import { MorningBriefing } from "@/components/morning-briefing";
import type { SchoolOverview } from "@/lib/school/types";
import { dueDateLabel } from "@/components/school/styles";
import { byUrgency, daysUntil, statusStyle } from "@/components/overview/due-helpers";

/**
 * Today tab — the day's schedule and tasks.
 * Due today, tonight's top 3, the check-in nudge. One glance, then go.
 */
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
    <main className="relative mx-auto max-w-3xl overflow-hidden px-4 pt-10 pb-8">
      <div className="firefly" style={{ width: 8, height: 8, top: "8%", left: "12%" }} />
      <div className="firefly" style={{ width: 6, height: 6, top: "26%", left: "86%", animationDelay: "1.4s" }} />

      <div className="animate-bloom flex items-center gap-4">
        <PookieOrb size={52} />
        <p className="text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">
          Today · flight plan
        </p>
      </div>
      <h1 className="text-sunlit animate-bloom mt-3 text-3xl font-semibold tracking-tight" style={{ animationDelay: "0.08s" }}>
        Today&apos;s flight plan for {childName}
      </h1>
      <p className="animate-bloom mt-2 text-sm text-stardust-300" style={{ animationDelay: "0.12s" }}>
        {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}
      </p>

      <MorningBriefing schoolDueCount={dueToday.length} checkinDone={!!overview.checkin_today} />

      {!overview.checkin_today && (
        <Link
          href={`/c/${childSlug}/school#checkin`}
          className="card-living animate-bloom mt-6 block rounded-2xl border border-aurum-400/25 px-5 py-4"
          style={{ animationDelay: "0.16s", boxShadow: "0 0 18px rgb(251 191 36 / 0.15)" }}
        >
          <p className="text-sm font-medium text-star-100">Today&apos;s check-in isn&apos;t logged yet</p>
          <p className="mt-1 text-sm text-stardust-300">Two minutes — how did the mission go today? →</p>
        </Link>
      )}

      <h2 className="animate-bloom mt-8 text-sm font-medium tracking-[0.2em] text-nova-400 uppercase" style={{ animationDelay: "0.2s" }}>
        On the radar today
      </h2>
      <div className="mt-3 grid gap-3">
        {dueToday.length === 0 ? (
          <p className="animate-bloom text-sm text-stardust-300" style={{ animationDelay: "0.22s" }}>
            Nothing on the radar — clear skies ahead. 🌤️
          </p>
        ) : (
          dueToday.map((item, i) => {
            const s = statusStyle(item.status);
            return (
              <Link
                key={item.id}
                href={`/c/${childSlug}/school/${item.class_slug}`}
                className="card-living animate-bloom flex items-center justify-between gap-3 rounded-2xl px-5 py-4"
                style={{ animationDelay: `${0.22 + i * 0.05}s` }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-star-100">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-stardust-300">
                    {item.class_name}
                    {item.category ? ` · ${item.category}` : ""}
                  </p>
                </div>
                <p className={`shrink-0 text-xs font-medium ${s.text}`}>
                  {item.status === "missing" || item.status === "late" ? s.label : dueDateLabel(item.due_date)}
                </p>
              </Link>
            );
          })
        )}
      </div>

      <h2 className="animate-bloom mt-8 text-sm font-medium tracking-[0.2em] text-nova-400 uppercase" style={{ animationDelay: "0.28s" }}>
        Tonight&apos;s flight priorities
      </h2>
      <div className="mt-3 grid gap-3">
        {tonight.length === 0 ? (
          <p className="animate-bloom text-sm text-stardust-300" style={{ animationDelay: "0.3s" }}>
            The evening is yours — no priority maneuvers on the board.
          </p>
        ) : (
          tonight.map((item, i) => {
            const s = statusStyle(item.status);
            return (
              <div
                key={item.id}
                className="card-living animate-bloom flex items-center gap-4 rounded-2xl px-5 py-4"
                style={{ animationDelay: `${0.3 + i * 0.05}s` }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-nova-400/30 text-sm font-bold text-nova-300"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-star-100">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-stardust-300">
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
        className="animate-bloom mt-8 inline-block text-sm font-medium text-nova-300 hover:text-nova-400"
        style={{ animationDelay: "0.36s" }}
      >
        Open the school console →
      </Link>
    </main>
  );
}
