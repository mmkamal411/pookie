"use client";

import type { SchoolEventBrief } from "@/server/services/school";

const KIND_LABEL: Record<string, string> = {
  picture_day: "Picture day",
  field_trip: "Field trip",
  fundraiser: "Fundraiser",
  spirit_week: "Spirit week",
  deadline: "Deadline",
  concert: "Concert",
  game: "Game",
  performance: "Performance",
  meeting: "Meeting",
  holiday: "Holiday",
  early_release: "Early release",
  club: "Club",
  volunteer: "Volunteering",
  other: "Event",
};

function eventLabel(dateStr: string | null): string {
  if (!dateStr) return "Date TBD";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((dt.getTime() - today.getTime()) / 86_400_000);
  const weekday = dt.toLocaleDateString("en-US", { weekday: "short" });
  const md = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (diff === 0) return `Today · ${md}`;
  if (diff === 1) return `Tomorrow · ${md}`;
  if (diff < 7) return `${weekday} · ${md}`;
  return md;
}

/**
 * School calendar — upcoming school events from the school_events table.
 * Ported from d-dash's Cobb calendar spirit (month grid → upcoming list,
 * collapsed by default). Empty state is poetic, never a void.
 */
export function SchoolCalendar({ events }: { events: SchoolEventBrief[] }) {
  if (events.length === 0) {
    return (
      <div className="awaiting-data rounded-2xl px-5 py-6 text-center">
        <p className="text-sm font-medium text-stardust-200">
          The calendar is clear — no school events on the radar yet. ✦
        </p>
        <p className="mt-1 text-xs text-stardust-400">
          Picture days, games, and holidays will appear here as they&apos;re added.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {events.map((e, i) => (
        <li
          key={e.id}
          className="animate-rise flex items-center gap-4 rounded-2xl border border-nova-400/15 bg-nebula-800/30 px-4 py-3"
          style={{ animationDelay: `${i * 0.04}s` }}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-sm font-medium text-star-100">{e.title}</p>
            <p className="text-xs text-stardust-400">
              {KIND_LABEL[e.kind] ?? "Event"}
              {e.detail ? ` · ${e.detail}` : ""}
            </p>
          </div>
          <span className="readout shrink-0 rounded-full border border-nova-400/25 bg-nebula-800/60 px-3 py-1 text-xs font-semibold text-nova-300">
            {eventLabel(e.event_date)}
          </span>
        </li>
      ))}
    </ul>
  );
}
