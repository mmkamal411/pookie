// Reference watcher: bills due soon or overdue → scored nudges.
// Pure function of HouseholdSignals — no I/O. The engine handles dedup,
// quiet hours, and delivery.

import type { HouseholdSignals, Nudge, Watcher } from "../../types";
import { scorePriority, scoreUrgency, tierForPriority } from "../engine";

const MS_PER_DAY = 86_400_000;

function fmtAmount(amount: number | null): string {
  if (amount == null) return "";
  return ` ($${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })})`;
}

/** Importance from stakes: bigger amounts and housing/utilities rank higher. */
function billImportance(amount: number | null): number {
  if (amount == null) return 40;
  if (amount >= 1000) return 90;
  if (amount >= 200) return 70;
  if (amount >= 50) return 50;
  return 30;
}

function dueLabel(days: number | null): string {
  if (days == null) return "with no due date set";
  if (days < 0) return `${-days} ${-days === 1 ? "day" : "days"} overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

export const billDueWatcher: Watcher = {
  name: "bill-due",
  // A dismissed bill nudge stays quiet until the due date passes — the
  // watcher re-fires naturally on the next bucket (overdue) if still unpaid.
  cooldownDays: 30,

  evaluate(signals: HouseholdSignals, now: Date): Nudge[] {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nudges: Nudge[] = [];

    const consider = (b: HouseholdSignals["billsDueSoon"][number], overdue: boolean) => {
      let days: number | null = null;
      if (b.dueDate) {
        const [y, m, d] = b.dueDate.split("-").map(Number);
        const due = new Date(y, m - 1, d);
        days = Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);
      }
      // Only nudge inside the 7-day window (or overdue). Far-future bills
      // are noise; the briefing counts them without a nudge.
      if (days != null && days > 7) return;

      const urgency = overdue ? 100 : scoreUrgency(days);
      const priority = scorePriority(urgency, billImportance(b.amount));
      const tier = tierForPriority(priority);
      if (!tier) return;

      const payee = b.payee ? ` to ${b.payee}` : "";
      const overdueNote = overdue
        ? " Pay it soon to avoid a late fee — tap below once it's paid and I'll clear it from the tracker."
        : " Tap below once you've paid and I'll mark it in the tracker.";
      nudges.push({
        householdId: signals.householdId,
        watcher: "bill-due",
        tier,
        priority,
        title: `${b.name}${fmtAmount(b.amount)} ${dueLabel(days)}`,
        detail: `${b.name}${fmtAmount(b.amount)}${payee} is ${dueLabel(days)}.${overdueNote}`,
        approval: "one-tap",
        action: {
          label: "Mark paid",
          kind: "bill.mark-paid",
          params: { billId: b.id },
        },
        dedupKey: `bill-due:${b.id}:${b.dueDate ?? "nodate"}`,
      });
    };

    for (const b of signals.billsOverdue) consider(b, true);
    for (const b of signals.billsDueSoon) consider(b, false);
    return nudges;
  },
};
