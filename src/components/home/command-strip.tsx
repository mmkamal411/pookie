"use client";

import { useState } from "react";
import type { ClassOverview, DueNextItem } from "@/lib/school/types";
import { isUrgent } from "@/components/overview/due-helpers";

/** Numeric grade → 4.0 scale (unweighted). */
function toGpa(numeric: number): number {
  if (numeric >= 97) return 4.0;
  if (numeric >= 93) return 4.0;
  if (numeric >= 90) return 3.7;
  if (numeric >= 87) return 3.3;
  if (numeric >= 83) return 3.0;
  if (numeric >= 80) return 2.7;
  if (numeric >= 77) return 2.3;
  if (numeric >= 73) return 2.0;
  if (numeric >= 70) return 1.7;
  if (numeric >= 67) return 1.3;
  if (numeric >= 65) return 1.0;
  return 0.0;
}

interface Kpi {
  label: string;
  value: string;
  tone: "good" | "warn" | "bad" | "neutral";
  detail: string;
}

function toneDot(tone: Kpi["tone"]): string {
  switch (tone) {
    case "good":
      return "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]";
    case "warn":
      return "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]";
    case "bad":
      return "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]";
    default:
      return "bg-stardust-500";
  }
}

/**
 * Command Strip — the 10-second executive read, ported from d-dash's KPI
 * strip. Three primary readouts up front; the full detail lives behind
 * the expand. Styled as ship instruments.
 */
export function CommandStrip({
  classes,
  dueNext,
  checkinStreak,
}: {
  classes: ClassOverview[];
  dueNext: DueNextItem[];
  checkinStreak: number;
}) {
  const [open, setOpen] = useState(false);

  const graded = classes.filter((c) => c.numeric != null);
  const atGoal = graded.filter((c) => (c.numeric ?? 0) >= 90).length;
  const gpa =
    graded.length > 0
      ? graded.reduce((s, c) => s + toGpa(c.numeric ?? 0), 0) / graded.length
      : null;
  const urgent = dueNext.filter(isUrgent);

  const kpis: Kpi[] = [
    {
      label: "90% goal",
      value: graded.length > 0 ? `${atGoal}/${graded.length}` : "—",
      tone: graded.length === 0 ? "neutral" : atGoal === graded.length ? "good" : atGoal >= graded.length / 2 ? "warn" : "bad",
      detail:
        graded.length === 0
          ? "No graded classes on the instruments yet."
          : `${atGoal} of ${graded.length} classes at or above the 90% goal.`,
    },
    {
      label: "GPA",
      value: gpa != null ? gpa.toFixed(2) : "—",
      tone: gpa == null ? "neutral" : gpa >= 3.5 ? "good" : gpa >= 3.0 ? "warn" : "bad",
      detail:
        gpa != null
          ? `Unweighted 4.0-scale average across ${graded.length} graded classes.`
          : "GPA appears once grades land on the instruments.",
    },
    {
      label: "On the radar",
      value: urgent.length > 0 ? String(urgent.length) : "0",
      tone: urgent.length === 0 ? "good" : urgent.length <= 2 ? "warn" : "bad",
      detail:
        urgent.length === 0
          ? "Clear skies — nothing urgent on the radar."
          : `${urgent.length} high-impact ${urgent.length === 1 ? "item" : "items"} due soon.`,
    },
    {
      label: "Log streak",
      value: checkinStreak > 0 ? `${checkinStreak}d` : "—",
      tone: checkinStreak >= 5 ? "good" : checkinStreak >= 2 ? "warn" : "neutral",
      detail:
        checkinStreak > 0
          ? `${checkinStreak} consecutive day${checkinStreak === 1 ? "" : "s"} of check-ins.`
          : "No streak yet — today is day one of the mission.",
    },
  ];

  const primary = kpis.slice(0, 3);

  return (
    <section
      aria-label="Key indicators"
      className="animate-bloom rounded-2xl border border-nova-400/20 bg-nebula-800/40"
      style={{ animationDelay: "0.22s" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Collapse key indicators" : "Expand key indicators"}
        className="w-full text-left"
      >
        <div className="grid w-full grid-cols-3 gap-3 px-5 py-4">
          {primary.map((k) => (
            <div key={k.label} className="min-w-0 text-center">
              <p className="truncate text-[11px] font-semibold tracking-[0.12em] text-stardust-400 capitalize">
                {k.label}
              </p>
              <p className="mt-1 flex items-center justify-center gap-1.5">
                <span className={`size-1.5 shrink-0 rounded-full ${toneDot(k.tone)}`} aria-hidden="true" />
                <span className="readout text-xl font-semibold text-star-100">{k.value}</span>
              </p>
            </div>
          ))}
        </div>
        {open && (
          <ul className="space-y-3 border-t border-nova-400/10 px-5 py-4">
            {kpis.map((k) => (
              <li key={k.label} className="flex items-start gap-3 text-xs">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${toneDot(k.tone)}`} aria-hidden="true" />
                <span className="font-medium text-stardust-200">{k.label}:</span>
                <span className="text-stardust-400">{k.detail}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="pb-3 text-center text-xs text-nova-300">
          {open ? "Show less ▴" : "All readouts ▾"}
        </p>
      </button>
    </section>
  );
}
