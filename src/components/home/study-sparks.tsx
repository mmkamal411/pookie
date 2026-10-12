"use client";

import type { StudySparkBrief } from "@/server/services/school";

/**
 * Study sparks — the "brain hacks" feed, ported from d-dash's TipFeed.
 * Shows the latest Pookie AI study sparks: short, actionable, unit-tagged.
 * Collapsed by default; expands on tap.
 */
export function StudySparks({ sparks }: { sparks: StudySparkBrief[] }) {
  if (sparks.length === 0) {
    return (
      <div className="awaiting-data rounded-2xl px-5 py-6 text-center">
        <p className="text-sm font-medium text-stardust-200">
          Brain hacks are brewing — fresh study sparks land every week. ✦
        </p>
        <p className="mt-1 text-xs text-stardust-400">
          Short, actionable tips from your classes and check-ins.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {sparks.map((s, i) => (
        <li
          key={s.id}
          className="animate-rise rounded-2xl border border-nova-400/15 bg-nebula-800/30 px-5 py-4"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <p className="text-sm leading-relaxed text-star-100">{s.body}</p>
          <p className="mt-2 text-xs font-medium tracking-[0.12em] text-nova-300 capitalize">
            {s.class_name ?? "Study spark"}
            {s.unit_tag ? ` · ${s.unit_tag}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
