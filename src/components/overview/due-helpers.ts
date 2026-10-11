// Client-safe helpers for ranking and labeling due items on the Home tab.
import type { DueNextItem } from "@/lib/school/types";

/** Whole days from now until the due date (null when no date). */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function isUrgent(item: DueNextItem): boolean {
  if (item.status === "missing" || item.status === "late") return true;
  const d = daysUntil(item.due_date);
  return d != null && d <= 2;
}

/** Missing → late → overdue → today → tomorrow → everything else by date. */
export function urgencyRank(item: DueNextItem): number {
  if (item.status === "missing") return 0;
  if (item.status === "late") return 1;
  const d = daysUntil(item.due_date);
  if (d == null) return 900;
  if (d < 0) return 2;
  if (d === 0) return 3;
  if (d === 1) return 4;
  return 5 + d;
}

export function byUrgency(a: DueNextItem, b: DueNextItem): number {
  return urgencyRank(a) - urgencyRank(b);
}

export function byDueDate(a: DueNextItem, b: DueNextItem): number {
  const da = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
  const db = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
  return da - db;
}

/** Status chip styling — soft, never harsh. Tone "white" deepens the text colors for white cards. */
export function statusStyle(
  status: string,
  tone: "dark" | "white" = "dark"
): { text: string; dot: string; label: string } {
  const white = tone === "white";
  switch (status) {
    case "missing":
      return { text: white ? "text-red-600" : "text-red-300", dot: "bg-red-400", label: "Missing — recover it" };
    case "late":
      return { text: white ? "text-red-600" : "text-red-300", dot: "bg-red-400", label: "Late — still turn it in" };
    case "graded":
      return { text: white ? "text-nova-600" : "text-nova-300", dot: "bg-nova-400", label: "Graded" };
    case "submitted":
      return { text: white ? "text-nova-600" : "text-nova-300", dot: "bg-nova-400", label: "Submitted" };
    default:
      return { text: white ? "text-amber-700" : "text-aurum-300", dot: "bg-aurum-400", label: "Upcoming" };
  }
}
