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
    text: "text-comet-300",
    ring: "border-comet-400/30",
    bar: "bg-comet-400",
    chip: "border-comet-400/40 text-comet-300",
    glow: "0 0 14px rgb(74 222 128 / 0.22)",
  },
  yellow: {
    text: "text-aurum-300",
    ring: "border-aurum-400/30",
    bar: "bg-aurum-400",
    chip: "border-aurum-400/40 text-aurum-300",
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

/** White-card tone — deeper shades for dark-on-white (Home tab). */
export const bandStylesWhite: Record<GradeBand, BandStyle> = {
  green: {
    text: "text-emerald-600",
    ring: "border-emerald-500/30",
    bar: "bg-emerald-500",
    chip: "border-emerald-500/40 bg-emerald-50 text-emerald-700",
    glow: "0 0 14px rgb(74 222 128 / 0.25)",
  },
  yellow: {
    text: "text-amber-600",
    ring: "border-amber-500/30",
    bar: "bg-amber-500",
    chip: "border-amber-500/40 bg-amber-50 text-amber-700",
    glow: "0 0 14px rgb(251 191 36 / 0.25)",
  },
  orange: {
    text: "text-orange-600",
    ring: "border-orange-500/30",
    bar: "bg-orange-500",
    chip: "border-orange-500/40 bg-orange-50 text-orange-700",
    glow: "0 0 14px rgb(251 146 60 / 0.25)",
  },
  red: {
    text: "text-red-600",
    ring: "border-red-500/30",
    bar: "bg-red-500",
    chip: "border-red-500/40 bg-red-50 text-red-700",
    glow: "0 0 14px rgb(248 113 113 / 0.28)",
  },
};

/** Pick the band palette for the card tone. */
export function bandStyleFor(band: GradeBand, tone: "dark" | "white" = "dark"): BandStyle {
  return tone === "white" ? bandStylesWhite[band] : bandStyles[band];
}
/** Gap-to-90 in words — the mission frame for every class. */
export function gapCopy(gap: number | null): string {
  if (gap == null) return "No grades on the instruments yet — holding position.";
  if (gap <= 0) return "Holding the 90 line — steady as she goes.";
  return `${gap.toFixed(1)} points to the 90 line`;
}

/** 7-day delta in words — a course to plot, not a red number. */
export function deltaCopy(delta: number | null): string | null {
  if (delta == null) return null;
  if (delta > 0.05) return `Up ${delta.toFixed(1)} this week — climbing.`;
  if (delta < -0.05) return `Down ${Math.abs(delta).toFixed(1)} this week — course correction below.`;
  return "Holding steady this week.";
}

export function dueDateLabel(iso: string | null): string {
  if (!iso) return "No due date";
  const due = new Date(iso);
  const now = new Date();
  const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "Course correction needed";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return due.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
