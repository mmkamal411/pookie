"use client";

import Link from "next/link";
import { gapTo90, gradeBand, letterGrade } from "@/lib/grades";
import type { ClassOverview } from "@/lib/school/types";
import { bandStyles, gapCopy } from "./styles";

/**
 * Classes list — d-dash comprehensiveness in spaceship style: period badge,
 * class name, teacher · room, grade pill (80|B), "+X to 90" under each grade.
 * Rows link to the class page.
 */
export function ClassesList({
  classes,
  childSlug,
  roomById,
}: {
  classes: ClassOverview[];
  childSlug: string;
  /** Optional class_id → room lookup (from curated metadata). */
  roomById?: Record<string, string | null>;
}) {
  if (classes.length === 0) {
    return (
      <div className="card-living awaiting-data rounded-2xl px-5 py-8 text-center">
        <p className="instrument-label">Grade instruments warming up</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-stardust-200">
          No classes on the board yet. The moment the first school sync
          lands, every dial lights up.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {classes.map((cls, i) => {
        const band = gradeBand(cls.numeric);
        const s = bandStyles[band];
        const gap = gapTo90(cls.numeric);
        const room = roomById?.[cls.class_id] ?? null;
        const displayName = cls.display_name ?? cls.name;
        return (
          <Link
            key={cls.class_id}
            href={`/c/${childSlug}/school/${cls.class_slug}`}
            className="card-living animate-bloom group flex items-center gap-4 rounded-2xl border px-4 py-3.5 sm:px-5"
            style={{ animationDelay: `${0.1 + i * 0.06}s`, boxShadow: s.glow }}
            aria-label={`${displayName}: ${cls.numeric != null ? cls.numeric.toFixed(1) : "no grade"}, ${letterGrade(cls.numeric)}. ${gapCopy(gap)}`}
          >
            {/* Period badge */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-nebula-700 text-sm font-bold text-star-100">
              {cls.period ?? "·"}
            </div>

            {/* Class info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-star-100">{displayName}</p>
              <p className="truncate text-xs text-stardust-300">
                {[cls.teacher_name, room ? `Room ${room}` : null].filter(Boolean).join(" · ") || "Teacher · Room syncing…"}
              </p>
            </div>

            {/* Grade pill + gap */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <span className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-base font-bold tabular-nums ${s.ring} ${s.text} transition-transform group-hover:scale-105`}>
                {cls.numeric != null ? Math.round(cls.numeric) : "—"}
                <span className="h-5 w-px bg-nova-400/25" aria-hidden="true" />
                <span>{letterGrade(cls.numeric)}</span>
              </span>
              {gap != null && gap > 0 ? (
                <span className="text-[10px] font-semibold text-stardust-300">+{gap.toFixed(0)} to 90</span>
              ) : gap != null ? (
                <span className="text-[10px] font-semibold text-comet-300">At 90 ✓</span>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
