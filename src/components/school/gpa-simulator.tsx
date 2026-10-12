"use client";

import { useState } from "react";
import type { GpaBlock } from "@/server/services/school-enrich";

function points(numeric: number): number {
  if (numeric >= 90) return 4.0;
  if (numeric >= 80) return 3.0;
  if (numeric >= 74) return 2.0;
  if (numeric >= 70) return 1.0;
  return 0.0;
}

function letter(numeric: number): string {
  if (numeric >= 90) return "A";
  if (numeric >= 80) return "B";
  if (numeric >= 74) return "C";
  if (numeric >= 70) return "D";
  return "F";
}

function bump(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("ap ") || n.startsWith("ap")) return 1.0;
  if (n.startsWith("h ") || n.includes("honors")) return 0.5;
  return 0;
}

/**
 * GPA Simulator — "What if? Adjust grades, see GPA change." Sliders per
 * class drive unweighted / weighted / HOPE live. Collapsed inside the
 * semester card.
 */
export function GpaSimulator({ gpa }: { gpa: GpaBlock }) {
  const graded = gpa.perClass.filter((c) => c.numeric != null);
  const [sim, setSim] = useState<Record<string, number>>(() =>
    Object.fromEntries(graded.map((c) => [c.classId, Math.round(c.numeric as number)]))
  );

  function setGrade(classId: string, val: number) {
    setSim((prev) => ({ ...prev, [classId]: Math.max(0, Math.min(100, val)) }));
  }

  function reset() {
    setSim(Object.fromEntries(graded.map((c) => [c.classId, Math.round(c.numeric as number)])));
  }

  const simUW =
    graded.reduce((s, c) => s + points(sim[c.classId] ?? (c.numeric as number)), 0) /
    Math.max(1, graded.length);
  const simW =
    graded.reduce((s, c) => s + points(sim[c.classId] ?? (c.numeric as number)) + bump(c.name), 0) /
    Math.max(1, graded.length);
  const delta = simUW - gpa.unweighted;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-nova-400/15 bg-nebula-800/60 p-3">
          <p className="text-xl font-bold tabular-nums text-star-100">{simUW.toFixed(2)}</p>
          <p className="mt-0.5 text-[10px] font-semibold tracking-widest text-stardust-300 capitalize">
            Unweighted
          </p>
          <p
            className={`mt-0.5 text-[11px] font-bold tabular-nums ${
              delta > 0.005 ? "text-comet-300" : delta < -0.005 ? "text-red-300" : "text-stardust-400"
            }`}
          >
            {delta > 0.005 ? "+" : ""}
            {delta.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-nova-400/15 bg-nebula-800/60 p-3">
          <p className="text-xl font-bold tabular-nums text-star-100">{simW.toFixed(2)}</p>
          <p className="mt-0.5 text-[10px] font-semibold tracking-widest text-stardust-300 capitalize">
            Weighted
          </p>
        </div>
        <div className="rounded-xl border border-nova-400/15 bg-nebula-800/60 p-3">
          <p className="text-xl font-bold tabular-nums text-star-100">{gpa.hope.toFixed(2)}</p>
          <p className="mt-0.5 text-[10px] font-semibold tracking-widest text-stardust-300 capitalize">
            HOPE
          </p>
        </div>
      </div>

      <div className="mt-4">
        {graded.map((c) => {
          const cur = Math.round(c.numeric as number);
          const val = sim[c.classId] ?? cur;
          const changed = val !== cur;
          return (
            <div key={c.classId} className="border-b border-nova-400/10 py-3 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-star-100">{c.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`text-sm font-bold tabular-nums ${changed ? "text-nova-300" : "text-star-100"}`}>
                    {val} <span className="text-xs text-stardust-300">{letter(val)}</span>
                  </span>
                  {changed && <span className="text-[11px] text-stardust-400">was {cur}</span>}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={val}
                onChange={(e) => setGrade(c.classId, parseInt(e.target.value, 10))}
                className="mt-2 w-full accent-cyan-300"
                aria-label={`${c.name} simulated grade`}
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={reset}
        className="mt-3 w-full rounded-xl border border-nova-400/20 bg-nebula-800/60 py-2.5 text-sm font-semibold text-star-100 transition hover:bg-nebula-700/60"
      >
        Reset to Current Grades
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-stardust-400">
        Cobb scale: A 90+ (4.0) · B 80–89 (3.0) · C 74–79 (2.0) · D 70–73 (1.0) · F below 70.
        Weighted adds +1.0 AP / +0.5 Honors. HOPE adds +0.5 AP only.
      </p>
    </div>
  );
}
