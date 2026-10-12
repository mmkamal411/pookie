"use client";

import { PookieOrb } from "@/components/pookie-orb";
import type { SchoolOverview } from "@/lib/school/types";
import { ClassCard } from "./class-card";
import { CheckinForm } from "./checkin-form";
import { dueDateLabel } from "./styles";

/**
 * /c/[childSlug]/school — "Is my child keeping up in school?"
 * Grades dashboard: 6 classes color-coded, gap-to-90 leading,
 * due-next rail, and today's check-in. The AI turns deltas into
 * causes and plans — never just red numbers.
 */
export function SchoolOverview({
  overview,
  childName,
  childSlug,
  childId,
  role,
}: {
  overview: SchoolOverview;
  childName: string;
  childSlug: string;
  childId: string;
  role: "parent" | "child";
}) {
  const needsAttention = overview.classes.filter((c) => c.numeric != null && c.numeric < 80).length;

  return (
    <main className="relative mx-auto max-w-5xl overflow-hidden px-4 py-10">
      <div className="firefly" style={{ width: 8, height: 8, top: "8%", left: "12%" }} />
      <div className="firefly" style={{ width: 6, height: 6, top: "22%", left: "86%", animationDelay: "1.4s" }} />
      <div className="firefly" style={{ width: 10, height: 10, top: "60%", left: "6%", animationDelay: "2.6s" }} />

      <div className="animate-bloom flex items-center gap-4">
        <PookieOrb size={56} />
        <p className="text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">
          School · keeping up
        </p>
      </div>

      <h1 className="text-sunlit animate-bloom mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        How {childName} is growing at school
      </h1>
      <p className="animate-bloom mt-3 max-w-xl leading-relaxed text-stardust-300" style={{ animationDelay: "0.08s" }}>
        The goal: <span className="font-semibold text-star-100">90%+ in every class</span>. Every
        number below is a starting point for a plan — never a judgment.
        {needsAttention > 0 && (
          <>
            {" "}{needsAttention} {needsAttention === 1 ? "class is" : "classes are"} getting extra
            love right now.
          </>
        )}
      </p>

      <h2 className="animate-bloom mt-10 text-sm font-medium tracking-[0.2em] text-nova-400 uppercase" style={{ animationDelay: "0.12s" }}>
        Classes
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {overview.classes.map((cls, i) => (
          <ClassCard key={cls.class_id} cls={cls} childSlug={childSlug} index={i} />
        ))}
      </div>

      <h2 className="animate-bloom mt-10 text-sm font-medium tracking-[0.2em] text-nova-400 uppercase" style={{ animationDelay: "0.2s" }}>
        Coming up next
      </h2>
      {overview.due_next.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {overview.due_next.map((item, i) => (
            <div
              key={item.id}
              className="card-living animate-bloom flex items-center justify-between gap-3 rounded-2xl px-5 py-4"
              style={{ animationDelay: `${0.24 + i * 0.06}s` }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-star-100">{item.title}</p>
                <p className="mt-0.5 text-xs text-stardust-300">
                  {item.class_name}
                  {item.category ? ` · ${item.category}` : ""}
                </p>
              </div>
              <p className={`shrink-0 text-xs font-medium ${item.status === "missing" || item.status === "late" ? "text-red-300" : "text-aurum-300"}`}>
                {item.status === "missing" ? "Missing — let's recover it" : item.status === "late" ? "Late — still worth turning in" : dueDateLabel(item.due_date)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="animate-bloom mt-4 text-sm text-stardust-300" style={{ animationDelay: "0.24s" }}>
          Nothing on the horizon — a clear, sunny stretch. 🌤️
        </p>
      )}

      <div className="mt-10" id="checkin">
        <CheckinForm childId={childId} childName={childName} doneToday={overview.checkin_today} />
      </div>

      <p className="mt-8 text-center text-xs text-stardust-500">
        Grades refresh with each school sync · {role === "parent" ? "Parent view" : "Student view"}
      </p>
    </main>
  );
}
