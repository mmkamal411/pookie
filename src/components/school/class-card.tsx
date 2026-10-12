"use client";

import Link from "next/link";
import { gapTo90, gradeBand, letterGrade } from "@/lib/grades";
import type { ClassOverview } from "@/lib/school/types";
import { GradeRing } from "@/components/instrument/grade-ring";
import { bandStyleFor, deltaCopy, gapCopy } from "./styles";

/**
 * One class on the grades dashboard. Numeric + letter side by side,
 * gap-to-90 leading (mission), raw grade never framed as judgment.
 * Single cockpit theme: deep-black instrument card, bright text.
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
  const s = bandStyleFor(band);
  const gap = gapTo90(cls.numeric);
  const delta = deltaCopy(cls.delta_7d);
  const displayName = cls.display_name ?? cls.name;

  return (
    <Link
      href={`/c/${childSlug}/school/${cls.class_slug}`}
      className={`card-cockpit animate-bloom block rounded-3xl border p-5 ${s.ring}`}
      style={{ animationDelay: `${0.1 + index * 0.07}s`, boxShadow: s.glow }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-star-100">{displayName}</p>
          <p className="mt-0.5 text-xs text-stardust-300">
            {[cls.period ? `Period ${cls.period}` : null, cls.teacher_name]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {/* Grade dial — the instrument readout: glowing ring + letter chip.
              The ring carries the round number; the caption keeps full precision. */}
          <div className="flex flex-col items-center gap-1">
            <GradeRing numeric={cls.numeric} size={58} />
            <span
              className={`readout-cool text-[10px] font-semibold tracking-wide ${s.text}`}
              aria-hidden="true"
            >
              {cls.numeric != null ? cls.numeric.toFixed(1) : "—"}
            </span>
          </div>
          <span className="h-10 w-px bg-nova-400/20" aria-hidden="true" />
          <span
            className={`readout inline-flex h-9 w-9 items-center justify-center rounded-full border text-base font-bold ${s.chip}`}
            aria-label={`Letter grade ${letterGrade(cls.numeric)}`}
          >
            {letterGrade(cls.numeric)}
          </span>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-nebula-800">
        <div
          className={`h-full rounded-full ${s.bar}`}
          style={{ width: `${cls.numeric != null ? Math.min(100, cls.numeric) : 0}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-stardust-100">{gapCopy(gap)}</p>
        {delta && <p className="text-xs text-stardust-300">{delta}</p>}
      </div>
    </Link>
  );
}
