"use client";

import Link from "next/link";
import { gapTo90, gradeBand, letterGrade } from "@/lib/grades";
import type { ClassOverview } from "@/lib/school/types";
import { bandStyleFor, deltaCopy, gapCopy } from "./styles";

/**
 * One class on the grades dashboard. Numeric + letter side by side,
 * gap-to-90 leading (mission), raw grade never framed as judgment.
 * Tone "white" renders the Home-tab white card; "dark" the Progress glass.
 */
export function ClassCard({
  cls,
  childSlug,
  index,
  tone = "dark",
}: {
  cls: ClassOverview;
  childSlug: string;
  index: number;
  tone?: "dark" | "white";
}) {
  const band = gradeBand(cls.numeric);
  const s = bandStyleFor(band, tone);
  const gap = gapTo90(cls.numeric);
  const delta = deltaCopy(cls.delta_7d);
  const displayName = cls.display_name ?? cls.name;
  const white = tone === "white";

  return (
    <Link
      href={`/c/${childSlug}/school/${cls.class_slug}`}
      className={`${white ? "card-white" : "card-living"} animate-bloom block rounded-3xl border p-5 ${s.ring}`}
      style={{ animationDelay: `${0.1 + index * 0.07}s`, boxShadow: s.glow }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-medium ${white ? "text-[#1f1f4a]" : "text-star-100"}`}>{displayName}</p>
          <p className={`mt-0.5 text-xs ${white ? "text-[#55557e]" : "text-stardust-300"}`}>
            {[cls.period ? `Period ${cls.period}` : null, cls.teacher_name]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className={`text-2xl font-semibold tabular-nums ${s.text}`}>
            {cls.numeric != null ? cls.numeric.toFixed(1) : "—"}
          </p>
          <span className={`h-8 w-px ${white ? "bg-nova-600/20" : "bg-nova-400/20"}`} aria-hidden="true" />
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-base font-bold ${s.chip}`}
            aria-label={`Letter grade ${letterGrade(cls.numeric)}`}
          >
            {letterGrade(cls.numeric)}
          </span>
        </div>
      </div>

      <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${white ? "bg-[#e3e1f2]" : "bg-nebula-800"}`}>
        <div
          className={`h-full rounded-full ${s.bar}`}
          style={{ width: `${cls.numeric != null ? Math.min(100, cls.numeric) : 0}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className={`text-xs font-medium ${white ? "text-[#2b2b54]" : "text-stardust-100"}`}>{gapCopy(gap)}</p>
        {delta && <p className={`text-xs ${white ? "text-[#55557e]" : "text-stardust-300"}`}>{delta}</p>}
      </div>
    </Link>
  );
}
