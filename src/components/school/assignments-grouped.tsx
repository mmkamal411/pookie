"use client";

import { useMemo, useState } from "react";
import type { AssignmentItem } from "@/lib/school/types";
import { dueDateLabel } from "./styles";
import { cleanCategory, matchWeight } from "@/lib/school/category-weights";

/** Amber/neutral ramp — low grades use amber, never harsh red. */
function pctHex(pct: number | null): string {
  if (pct == null) return "#a1a1aa";
  if (pct >= 90) return "#6ee7b7";
  if (pct >= 80) return "#a5b4fc";
  if (pct >= 74) return "#fcd34d";
  if (pct >= 70) return "#fdba74";
  return "#fbbf24";
}

function pctOf(a: AssignmentItem): number | null {
  if (a.points_earned != null && a.points_possible != null && a.points_possible > 0) {
    return (a.points_earned / a.points_possible) * 100;
  }
  return null;
}

function isMissing(a: AssignmentItem): boolean {
  return a.status === "missing" || (pctOf(a) === 0 && a.status === "graded");
}

function isUpcoming(a: AssignmentItem): boolean {
  if (!a.due_date) return false;
  const due = new Date(a.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() >= today.getTime() && a.status !== "graded" && a.status !== "submitted";
}

function Row({
  a,
  right,
  rightColor,
}: {
  a: AssignmentItem;
  right: string;
  rightColor: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-nova-400/10 bg-nebula-800/60 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-star-100" title={a.title}>
          {a.title}
        </p>
        <p className="truncate text-xs text-stardust-400">
          {cleanCategory(a.category)}
          {a.due_date ? ` · ${dueDateLabel(a.due_date)}` : ""}
          {a.points_earned != null && a.points_possible ? ` · ${a.points_earned}/${a.points_possible}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: rightColor }}>
        {right}
      </span>
    </div>
  );
}

/**
 * Assignments grouped by impact: Missing Work → Upcoming → Past.
 * Missing work shows the fastest climb first (zeros with category weight).
 */
export function AssignmentsGrouped({
  assignments,
  slug,
}: {
  assignments: AssignmentItem[];
  slug: string | null;
}) {
  const { missing, upcoming, past } = useMemo(() => {
    const missing = assignments.filter(isMissing);
    const upcoming = assignments.filter((a) => !isMissing(a) && isUpcoming(a));
    const past = assignments.filter((a) => !isMissing(a) && !isUpcoming(a));
    return { missing, upcoming, past };
  }, [assignments]);

  const [pastOpen, setPastOpen] = useState(false);

  if (assignments.length === 0) {
    return (
      <p className="rounded-2xl border border-nova-400/10 bg-nebula-900/60 px-5 py-6 text-center text-sm text-stardust-300">
        No assignments tracked yet for this class — they&apos;ll appear with the next sync.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {missing.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-star-100">
            ⚠️ Missing Work <span className="font-normal text-stardust-300">({missing.length}) — points waiting for you</span>
          </h3>
          <div className="space-y-2">
            {missing.map((a) => {
              const matched = slug ? matchWeight(slug, a.category ?? "") : null;
              const pct = pctOf(a);
              return (
                <Row
                  key={a.id}
                  a={a}
                  right={matched && pct === 0 ? `costing ~${matched.weight}% of grade` : "Missing"}
                  rightColor="#fbbf24"
                />
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-bold text-star-100">
          📅 Upcoming <span className="font-normal text-stardust-300">{upcoming.length > 0 ? `(${upcoming.length})` : ""}</span>
        </h3>
        {upcoming.length > 0 ? (
          <div className="space-y-2">
            {upcoming.map((a) => (
              <Row key={a.id} a={a} right={dueDateLabel(a.due_date)} rightColor="#a5b4fc" />
            ))}
          </div>
        ) : (
          <p className="text-xs text-stardust-300">Nothing with a future due date right now — clear runway.</p>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setPastOpen(!pastOpen)}
          aria-expanded={pastOpen}
          className="flex w-full items-center justify-between gap-2 text-sm font-bold text-star-100"
        >
          <span>📚 Past Assignments <span className="font-normal text-stardust-300">({past.length})</span></span>
          <span aria-hidden="true" className={`text-stardust-400 transition-transform ${pastOpen ? "rotate-180" : ""}`}>▾</span>
        </button>
        {pastOpen && (
          <div className="mt-2 space-y-2">
            {past.map((a) => {
              const pct = pctOf(a);
              return (
                <Row
                  key={a.id}
                  a={a}
                  right={pct != null ? `${pct.toFixed(0)}%` : a.status === "submitted" ? "Submitted" : "—"}
                  rightColor={pctHex(pct)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
