"use client";

// Morning Briefing Digest — the day at a glance (Squad Value).
// Unifies: school due-today, open tasks, bills due soon, check-in status.
// This is the "addictive morning ritual" — one glance, then go.

import { useEffect, useState } from "react";

interface BriefingData {
  tasksDueToday: number;
  tasksOverdue: number;
  billsDueSoon: number;
  billsTotal: string | null;
}

async function fetchBriefing(): Promise<BriefingData> {
  const [tasksRes, billsRes] = await Promise.all([
    fetch("/api/v1/household/tasks?status=open").then((r) => r.json()).catch(() => null),
    fetch("/api/v1/household/bills?status=unpaid").then((r) => r.json()).catch(() => null),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  let tasksDueToday = 0;
  let tasksOverdue = 0;
  if (tasksRes?.ok && Array.isArray(tasksRes.data?.tasks)) {
    for (const t of tasksRes.data.tasks) {
      if (t.due_date === today) tasksDueToday++;
      else if (t.due_date && t.due_date < today) tasksOverdue++;
    }
  }

  let billsDueSoon = 0;
  let billsTotal: string | null = null;
  if (billsRes?.ok && Array.isArray(billsRes.data?.bills)) {
    const weekOut = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    let total = 0;
    for (const b of billsRes.data.bills) {
      if (b.due_date && b.due_date >= today && b.due_date <= weekOut) {
        billsDueSoon++;
        if (b.amount) total += Number(b.amount);
      }
    }
    if (billsDueSoon > 0) billsTotal = `$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  return { tasksDueToday, tasksOverdue, billsDueSoon, billsTotal };
}

export function MorningBriefing({
  schoolDueCount,
  checkinDone,
}: {
  schoolDueCount: number;
  checkinDone: boolean;
}) {
  const [data, setData] = useState<BriefingData | null>(null);

  useEffect(() => {
    fetchBriefing().then(setData).catch(() => {});
  }, []);

  const items: { label: string; urgent: boolean }[] = [];
  if (schoolDueCount > 0) items.push({ label: `${schoolDueCount} school ${schoolDueCount === 1 ? "item" : "items"} due`, urgent: true });
  if (data) {
    if (data.tasksOverdue > 0) items.push({ label: `${data.tasksOverdue} overdue ${data.tasksOverdue === 1 ? "task" : "tasks"}`, urgent: true });
    if (data.tasksDueToday > 0) items.push({ label: `${data.tasksDueToday} ${data.tasksDueToday === 1 ? "task" : "tasks"} due today`, urgent: false });
    if (data.billsDueSoon > 0) items.push({ label: `${data.billsDueSoon} ${data.billsDueSoon === 1 ? "bill" : "bills"} due this week${data.billsTotal ? ` (${data.billsTotal})` : ""}`, urgent: data.billsDueSoon > 0 });
  }
  if (!checkinDone) items.push({ label: "Check-in not logged", urgent: false });

  if (items.length === 0) {
    return (
      <div className="glass-pane animate-bloom mt-6 p-4" style={{ animationDelay: "0.14s" }}>
        <p className="text-sm text-stardust-200">🌤️ Clear skies — nothing urgent on the board today.</p>
      </div>
    );
  }

  return (
    <div className="glass-pane animate-bloom mt-6 p-4" style={{ animationDelay: "0.14s" }}>
      <p className="text-xs font-semibold capitalize tracking-widest text-nova-300">Morning briefing</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span
              className={`h-1.5 w-1.5 rounded-full ${item.urgent ? "bg-amber-400" : "bg-nova-400"}`}
              aria-hidden
            />
            <span className={item.urgent ? "text-amber-200" : "text-stardust-200"}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
