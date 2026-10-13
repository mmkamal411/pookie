"use client";

import { useEffect, useState } from "react";
import { PanelShell, PanelNote } from "./panel-shell";
import type { FamilyTask } from "@/server/services/tasks";

interface Bill {
  id: string;
  title?: string;
  name?: string;
  due_date: string | null;
  amount?: number | string | null;
}

interface DayItem {
  key: string;
  label: string;
  kind: "task" | "bill";
  time?: string | null;
}

/**
 * CalendarPanel — the week ahead at a glance.
 *
 * INTEGRATION SEAM: today this composes dated items the pilot already has
 * (tasks with due dates + bills with due dates). When a real calendar feed
 * lands (e.g. Google Calendar sync), merge its events here in load() — the
 * DayItem shape is feed-agnostic.
 */
export function CalendarPanel({ highlighted, bare }: { highlighted?: boolean; bare?: boolean }) {
  const [days, setDays] = useState<{ date: string; items: DayItem[] }[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [tasksRes, billsRes] = await Promise.all([
          fetch("/api/v1/household/tasks?status=open").then((r) => r.json()).catch(() => null),
          fetch("/api/v1/household/bills?status=unpaid").then((r) => r.json()).catch(() => null),
        ]);
        if (!live) return;
        const items: DayItem[] = [];
        const tasks: FamilyTask[] = tasksRes?.ok && Array.isArray(tasksRes.data) ? tasksRes.data : [];
        for (const t of tasks) {
          if (!t.due_date) continue;
          items.push({ key: `t-${t.id}`, label: t.title, kind: "task", time: t.due_time });
        }
        const bills: Bill[] = billsRes?.ok && Array.isArray(billsRes.data?.bills) ? billsRes.data.bills : [];
        for (const b of bills) {
          if (!b.due_date) continue;
          items.push({ key: `b-${b.id}`, label: b.title ?? b.name ?? "Bill", kind: "bill" });
        }
        const today = new Date().toISOString().slice(0, 10);
        const week: { date: string; items: DayItem[] }[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(Date.now() + i * 864e5).toISOString().slice(0, 10);
          week.push({
            date: d,
            items: items
              .filter((it) => {
                const itemDate = it.key.startsWith("t-")
                  ? tasks.find((t) => `t-${t.id}` === it.key)?.due_date
                  : bills.find((b) => `b-${b.id}` === it.key)?.due_date;
                return itemDate === d;
              })
              .slice(0, 4),
          });
        }
        // Carry overdue items into today so they stay visible.
        const overdue = items.filter((it) => {
          const itemDate = it.key.startsWith("t-")
            ? tasks.find((t) => `t-${t.id}` === it.key)?.due_date
            : bills.find((b) => `b-${b.id}` === it.key)?.due_date;
          return itemDate != null && itemDate < today;
        });
        if (overdue.length > 0) {
          week[0] = { date: week[0].date, items: [...overdue.slice(0, 4), ...week[0].items].slice(0, 5) };
        }
        setDays(week);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <PanelShell bare={bare} eyebrow="Orbit" title="This week" highlighted={highlighted}>
      {failed || days === null ? (
        <PanelNote>
          {failed ? "Your week is unreachable right now — check back in a bit." : "Charting your week…"}
        </PanelNote>
      ) : (
        <ol className="space-y-1">
          {days.map((d) => {
            const date = new Date(d.date + "T12:00:00");
            const isToday = d.date === todayStr;
            return (
              <li
                key={d.date}
                className={`flex items-start gap-3 rounded-2xl px-2 py-2 ${isToday ? "bg-nova-500/10" : ""}`}
              >
                <div className="w-14 shrink-0 pt-0.5">
                  <p className={`text-[11px] font-semibold ${isToday ? "text-nova-300" : "text-stardust-300"}`}>
                    {isToday ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" })}
                  </p>
                  <p className="text-[11px] text-stardust-500">
                    {date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  {d.items.length === 0 ? (
                    <p className="pt-1 text-xs text-stardust-500">—</p>
                  ) : (
                    <ul className="space-y-1">
                      {d.items.map((it) => (
                        <li key={it.key} className="flex items-center gap-2 text-xs">
                          <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${it.kind === "bill" ? "bg-amber-400" : "bg-nova-400"}`}
                          />
                          <span className="truncate text-stardust-200">{it.label}</span>
                          {it.time && <span className="shrink-0 text-stardust-500">{it.time.slice(0, 5)}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </PanelShell>
  );
}
