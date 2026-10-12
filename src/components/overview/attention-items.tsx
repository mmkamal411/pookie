"use client";

import Link from "next/link";
import { gapTo90, gradeBand, letterGrade } from "@/lib/grades";
import type { ClassOverview, DueNextItem } from "@/lib/school/types";
import { bandStyleFor, deltaCopy, gapCopy, dueDateLabel } from "@/components/school/styles";
import { isUrgent, statusStyle } from "./due-helpers";

/**
 * Attention items — classes below the 80 line, lowest first, each with the
 * urgent work that moves them. Shame-free by rule: gap-to-90 leads,
 * recovery framed as the fastest climb.
 */
export function AttentionItems({
  classes,
  dueNext,
  childSlug,
}: {
  classes: ClassOverview[];
  dueNext: DueNextItem[];
  childSlug: string;
}) {
  const needing = classes
    .filter((c) => c.numeric != null && c.numeric < 80)
    .sort((a, b) => (a.numeric ?? 0) - (b.numeric ?? 0));

  // No instruments on the board yet — the readouts are warming up, not empty.
  if (classes.length === 0) {
    return (
      <div className="card-living awaiting-data rounded-2xl px-5 py-6 text-center">
        <p className="instrument-label">Readouts warming up</p>
        <p className="mt-2 text-sm text-stardust-200">
          No classes on the instruments yet. Add the first class and the
          board will come alive — the mission starts there. ✦
        </p>
      </div>
    );
  }

  if (needing.length === 0) {
    return (
      <div className="card-white love-halo rounded-2xl px-5 py-4">
        <p className="text-sm text-[#1f1f4a]">
          Nothing needs extra love right now — every class is at or above 80. 🌱
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {needing.map((cls, i) => {
        const band = gradeBand(cls.numeric);
        const s = bandStyleFor(band, "white");
        const gap = gapTo90(cls.numeric);
        const delta = deltaCopy(cls.delta_7d);
        const urgent = dueNext
          .filter((d) => d.class_id === cls.class_id && isUrgent(d))
          .slice(0, 3);
        const displayName = cls.display_name ?? cls.name;

        return (
          <article
            key={cls.class_id}
            className="card-white animate-bloom rounded-2xl border p-5"
            style={{ animationDelay: `${0.05 + i * 0.06}s`, borderColor: "rgb(244 114 182 / 0.25)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-[#1f1f4a]">{displayName}</p>
                <p className="mt-1 text-xs text-[#55557e]">
                  {gapCopy(gap)}
                  {delta ? ` · ${delta}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <p className={`readout text-xl font-semibold tabular-nums ${s.text}`}>
                  {cls.numeric != null ? cls.numeric.toFixed(1) : "—"}
                </p>
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${s.chip}`}
                  aria-label={`Letter grade ${letterGrade(cls.numeric)}`}
                >
                  {letterGrade(cls.numeric)}
                </span>
              </div>
            </div>

            {urgent.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-nova-600/15 pt-3">
                {urgent.map((item) => {
                  const st = statusStyle(item.status, "white");
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm text-[#2b2b54]">
                        <span className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${st.dot}`} aria-hidden="true" />
                        {item.title}
                      </p>
                      <p className={`shrink-0 text-xs font-medium ${st.text}`}>
                        {item.status === "missing" || item.status === "late"
                          ? st.label.split(" — ")[0]
                          : dueDateLabel(item.due_date)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}

            <Link
              href={`/c/${childSlug}/school/${cls.class_slug}`}
              className="mt-3 inline-block text-sm font-medium text-nova-600 hover:text-nova-500"
            >
              Open {displayName} →
            </Link>
          </article>
        );
      })}
    </div>
  );
}
