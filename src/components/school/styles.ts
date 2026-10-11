// W1 School Core — shared presentation helpers (client-safe).
// Color language: green ≥90 · yellow 80–89 · orange 70–79 · red <70.
// Soft glows only, never harsh. Copy is shame-free by rule: lead with the
// gap to 90 (mission framing), never the raw grade (judgment).
import type { GradeBand } from "@/lib/grades";

export interface BandStyle {
  text: string;
  ring: string;
  bar: string;
  chip: string;
  glow: string;
}

export const bandStyles: Record<GradeBand, BandStyle> = {
  green: {
    text: "text-leaf-300",
    ring: "border-leaf-400/30",
    bar: "bg-leaf-400",
    chip: "border-leaf-400/40 text-leaf-300",
    glow: "0 0 14px rgb(74 222 128 / 0.22)",
  },
  yellow: {
    text: "text-sunlight-300",
    ring: "border-sunlight-400/30",
    bar: "bg-sunlight-400",
    chip: "border-sunlight-400/40 text-sunlight-300",
    glow: "0 0 14px rgb(251 191 36 / 0.22)",
  },
  orange: {
    text: "text-orange-300",
    ring: "border-orange-400/30",
    bar: "bg-orange-400",
    chip: "border-orange-400/40 text-orange-300",
    glow: "0 0 14px rgb(251 146 60 / 0.22)",
  },
  red: {
    text: "text-red-300",
    ring: "border-red-400/30",
    bar: "bg-red-400",
    chip: "border-red-400/40 text-red-300",
    glow: "0 0 14px rgb(248 113 113 / 0.25)",
  },
};

/** Gap-to-90 in words — the mission frame for every class. */
export function gapCopy(gap: number | null): string {
  if (gap == null) return "Not graded yet this term — no judgment, just watching.";
  if (gap <= 0) return "Holding strong at the 90 goal — keep growing.";
  return `${gap.toFixed(1)} points from the 90 goal`;
}

/** 7-day delta in words — a cause to plan around, not a red number. */
export function deltaCopy(delta: number | null): string | null {
  if (delta == null) return null;
  if (delta > 0.05) return `Up ${delta.toFixed(1)} this week — growth is showing.`;
  if (delta < -0.05) return `Down ${Math.abs(delta).toFixed(1)} this week — the plan below answers it.`;
  return "Steady this week.";
}

export function dueDateLabel(iso: string | null): string {
  if (!iso) return "No due date";
  const due = new Date(iso);
  const now = new Date();
  const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "Overdue — gentle nudge";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return due.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
