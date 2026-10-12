"use client";

import { useMemo, useState } from "react";
import {
  COBB_CATEGORIES,
  COBB_EVENTS,
  cobbStyleFor,
  type CobbEvent,
} from "@/lib/school/cobb-calendar";
import { Collapsible } from "./collapsible";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function eventsOnDay(events: CobbEvent[], key: string): CobbEvent[] {
  return events.filter((e) => e.start <= key && key <= e.end);
}

/**
 * Cobb County School District calendar — month grid, color-coded legend,
 * collapsed by default. Dark-cosmos styling.
 */
export function CobbCalendar({ events = COBB_EVENTS }: { events?: CobbEvent[] }) {
  const todayKey = useMemo(() => toDayKey(new Date()), []);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const categories = useMemo(() => Array.from(new Set(events.map((e) => e.category))), [events]);
  const selectedEvents = useMemo(
    () => (selectedKey ? eventsOnDay(events, selectedKey) : []),
    [selectedKey, events]
  );

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startOffset = first.getDay();
    const arr: { date: Date; inMonth: boolean; key: string }[] = [];
    for (let i = 0; i < 42; i++) {
      const dayNum = i - startOffset + 1;
      const date = new Date(viewYear, viewMonth, dayNum);
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      arr.push({ date, inMonth: dayNum >= 1 && dayNum <= daysInMonth, key: toDayKey(date) });
    }
    return arr;
  }, [viewYear, viewMonth]);

  function goMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setViewMonth(m);
    setViewYear(y);
    setSelectedKey(null);
  }

  function goToday() {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedKey(toDayKey(now));
  }

  const selectedDate = selectedKey ? parseKey(selectedKey) : null;

  // Upcoming strip — the next 3 district events from today.
  const upcoming = useMemo(() => {
    const upcomingList = events
      .filter((e) => e.end >= todayKey)
      .sort((a, b) => (a.start < b.start ? -1 : 1))
      .slice(0, 3);
    return upcomingList;
  }, [events, todayKey]);

  function daysUntil(key: string): string {
    const diff = Math.round(
      (parseKey(key).getTime() - parseKey(todayKey).getTime()) / 86400000
    );
    if (diff <= 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return `In ${diff} days`;
  }

  return (
    <Collapsible title="Cobb County School District Calendar" subtitle="Tap a day for details">
      {/* Upcoming strip — next events on the horizon */}
      {upcoming.length > 0 && (
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          {upcoming.map((e, i) => {
            const s = cobbStyleFor(e.category);
            return (
              <button
                key={`${e.title}-${e.start}-${i}`}
                type="button"
                onClick={() => {
                  const d = parseKey(e.start);
                  setViewYear(d.getFullYear());
                  setViewMonth(d.getMonth());
                  setSelectedKey(e.start);
                }}
                className="holo-panel group px-3.5 py-3 text-left transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <p
                  className="text-[10px] font-bold tracking-wider uppercase"
                  style={{ color: s.dot }}
                >
                  {daysUntil(e.start)}
                </p>
                <p className="mt-1 line-clamp-2 text-[13px] font-bold leading-snug text-star-100">
                  {e.title}
                </p>
                <p className="mt-1 text-[11px] text-stardust-400">
                  {parseKey(e.start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </p>
              </button>
            );
          })}
        </div>
      )}
      <section aria-label="Cobb County school calendar" className="overflow-hidden rounded-2xl border border-nova-400/15 bg-nebula-900/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-nova-400/10 px-4 py-3">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            aria-label="Previous month"
            className="rounded-full p-2 text-stardust-300 transition hover:bg-nebula-700/60 hover:text-star-100 active:scale-90"
          >
            ←
          </button>
          <div className="text-center">
            <h3 className="text-base font-bold text-star-100">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h3>
            <p className="text-[11px] text-stardust-400">Cobb County School District · 2026–27</p>
          </div>
          <button
            type="button"
            onClick={() => goMonth(1)}
            aria-label="Next month"
            className="rounded-full p-2 text-stardust-300 transition hover:bg-nebula-700/60 hover:text-star-100 active:scale-90"
          >
            →
          </button>
        </div>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 px-2 pt-3">
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-1 text-center text-[10px] font-bold tracking-wide text-stardust-400 capitalize">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-0.5 px-2 pb-2">
          {cells.map(({ date, inMonth, key }) => {
            const dayEvents = eventsOnDay(events, key);
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(isSelected ? null : key)}
                aria-label={`${MONTH_NAMES[date.getMonth()]} ${date.getDate()}${dayEvents.length ? `, ${dayEvents.length} events` : ""}`}
                aria-pressed={isSelected}
                className={`relative flex min-h-[44px] flex-col items-center justify-start rounded-xl pt-1.5 transition ${
                  inMonth ? "text-star-100" : "text-stardust-500/50"
                } ${
                  isSelected
                    ? "bg-nova-400/30 text-white"
                    : isToday
                      ? "bg-nebula-700/60"
                      : "hover:bg-nebula-700/40 active:bg-nebula-700/60"
                }`}
              >
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-[13px] font-semibold ${
                    isToday && !isSelected ? "ring-2 ring-nova-400" : ""
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="flex items-center gap-[3px] pb-1 pt-0.5" aria-hidden="true">
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <span
                        key={`${e.title}-${i}`}
                        className="size-1.5 rounded-full"
                        style={{ background: cobbStyleFor(e.category).dot }}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day detail */}
        {selectedKey && (
          <div className="border-t border-nova-400/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-star-100">
                {selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <button
                type="button"
                onClick={goToday}
                className="rounded-full bg-nebula-700/60 px-3 py-1 text-[11px] font-semibold text-star-100 hover:bg-nebula-600/60"
              >
                Today
              </button>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="mt-2 text-sm text-stardust-300">
                Regular school day — nothing special on the district calendar.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {selectedEvents.map((e, i) => {
                  const s = cobbStyleFor(e.category);
                  const multiDay = e.start !== e.end;
                  return (
                    <li
                      key={`${e.title}-${e.start}-${i}`}
                      className="flex items-start gap-2.5 rounded-xl border border-nova-400/10 bg-nebula-800/60 px-3 py-2.5"
                    >
                      <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: s.dot }} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-star-100">{e.title}</p>
                        {multiDay && (
                          <p className="mt-0.5 text-[11px] text-stardust-400">
                            {parseKey(e.start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {" – "}
                            {parseKey(e.end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${s.chip}`}>
                        {s.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="border-t border-nova-400/10 bg-nebula-800/40 px-4 py-3">
          <p className="mb-2 text-[10px] font-bold tracking-[0.14em] text-stardust-400 capitalize">Legend</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {categories.map((cat) => {
              const s = cobbStyleFor(cat);
              return (
                <span key={cat} className="inline-flex items-center gap-1.5 text-xs font-medium text-stardust-200">
                  <span className="size-2.5 rounded-full" style={{ background: s.dot }} aria-hidden="true" />
                  {s.label}
                </span>
              );
            })}
            {categories.length === 0 &&
              COBB_CATEGORIES.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1.5 text-xs font-medium text-stardust-200">
                  <span className="size-2.5 rounded-full" style={{ background: c.dot }} aria-hidden="true" />
                  {c.label}
                </span>
              ))}
          </div>
        </div>
      </section>
    </Collapsible>
  );
}
