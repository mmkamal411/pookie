"use client";

import Link from "next/link";
import { gapTo90, gradeBand, letterGrade } from "@/lib/grades";
import type { ClassOverview } from "@/lib/school/types";
import { bandStyles, deltaCopy, gapCopy } from "./styles";

/**
 * One class on the grades dashboard. Numeric + letter side by side,
 * gap-to-90 leading (mission), raw grade never framed as judgment.
 */
export function ClassCard({
  cls,
  childSlug,
  index,
}: {
  cls: ClassOverview;
  childSlug: string;
  index: number;
}) {
  const band = gradeBand(cls.numeric);
  const s = bandStyles[band];
  const gap = gapTo90(cls.numeric);
  const delta = deltaCopy(cls.delta_7d);
  const displayName = cls.display_name ?? cls.name;

  return (
    <Link
      href={`/c/${childSlug}/school/${cls.class_slug}`}
      className={`card-living animate-bloom block rounded-3xl border p-5 ${s.ring}`}
      style={{ animationDelay: `${0.1 + index * 0.07}s`, boxShadow: s.glow }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-dew-100">{displayName}</p>
          <p className="mt-0.5 text-xs text-bark-300">
            {[cls.period ? `Period ${cls.period}` : null, cls.teacher_name]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className={`text-2xl font-semibold tabular-nums ${s.text}`}>
            {cls.numeric != null ? cls.numeric.toFixed(1) : "—"}
          </p>
          <span className="h-8 w-px bg-leaf-400/20" aria-hidden="true" />
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-base font-bold ${s.chip}`}
            aria-label={`Letter grade ${letterGrade(cls.numeric)}`}
          >
            {letterGrade(cls.numeric)}
          </span>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canopy-800">
        <div
          className={`h-full rounded-full ${s.bar}`}
          style={{ width: `${cls.numeric != null ? Math.min(100, cls.numeric) : 0}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-bark-100">{gapCopy(gap)}</p>
        {delta && <p className="text-xs text-bark-300">{delta}</p>}
      </div>
    </Link>
  );
}
