"use client";

import { useMemo, useState } from "react";
import type { AssignmentItem } from "@/lib/school/types";
import { cleanCategory, CATEGORY_WEIGHTS } from "@/lib/school/category-weights";

function pctOf(a: AssignmentItem): number | null {
  if (a.points_earned != null && a.points_possible != null && a.points_possible > 0) {
    return (a.points_earned / a.points_possible) * 100;
  }
  return null;
}

function cleanTitle(title: string): string {
  return (title || "").replace(/^\[.*?\]\s*/, "").trim() || title;
}

interface CatGroup {
  name: string;
  weight: number;
  pcts: number[]; // one per assignment, in the same order as assignmentsInCat
  assignments: AssignmentItem[];
}

function groupByCategory(assignments: AssignmentItem[], weights: Record<string, number>): CatGroup[] {
  const map = new Map<string, CatGroup>();
  for (const a of assignments) {
    // Match the raw category to a weighted bucket by normalized name.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
    const raw = cleanCategory(a.category);
    const key = Object.keys(weights).find((k) => norm(k) === norm(raw))
      ?? Object.keys(weights).find((k) => norm(k).includes(norm(raw)) || norm(raw).includes(norm(k)))
      ?? raw;
    const weight = weights[key] ?? 0;
    const pct = pctOf(a) ?? (a.status === "missing" ? 0 : null);
    if (pct == null) continue; // ungraded future work doesn't move the average
    let g = map.get(key);
    if (!g) {
      g = { name: key, weight, pcts: [], assignments: [] };
      map.set(key, g);
    }
    g.pcts.push(pct);
    g.assignments.push(a);
  }
  return [...map.values()];
}

function overallOf(groups: CatGroup[]): number | null {
  const weighted = groups.filter((g) => g.weight > 0);
  if (weighted.length === 0) return null;
  const totalWeight = weighted.reduce((s, g) => s + g.weight, 0);
  if (totalWeight === 0) return null;
  const sum = weighted.reduce((s, g) => {
    const avg = g.pcts.reduce((a, p) => a + p, 0) / g.pcts.length;
    return s + (g.weight / 100) * avg;
  }, 0);
  return (sum / totalWeight) * 100;
}

/**
 * Assignment What-If — "what if I score X on this?" Pick a missing or low
 * assignment, slide the score, watch the estimated overall grade move.
 * Category-weight aware: prefers live classes.grade_weights, falls back to
 * the curated Cobb weights.
 */
export function WhatIfSimulator({
  assignments,
  slug,
  currentGrade,
  liveWeights,
}: {
  assignments: AssignmentItem[];
  slug: string | null;
  currentGrade: number | null;
  /** Live weights from classes.grade_weights — win over the curated table. */
  liveWeights?: Record<string, number> | null;
}) {
  const weights = liveWeights && Object.keys(liveWeights).length > 0
    ? liveWeights
    : slug != null
      ? CATEGORY_WEIGHTS[slug] ?? null
      : null;
  const hasWeights = weights != null;
  const groups = useMemo(
    () => (weights ? groupByCategory(assignments, weights) : []),
    [assignments, weights]
  );
  const baseline = useMemo(() => overallOf(groups), [groups]);

  // Candidates: missing/zeros first, then the lowest scores.
  const candidates = useMemo(() => {
    const all: { a: AssignmentItem; pct: number; cat: string }[] = [];
    for (const g of groups) {
      g.assignments.forEach((a, i) => {
        all.push({ a, pct: g.pcts[i], cat: g.name });
      });
    }
    return all.sort((x, y) => x.pct - y.pct).slice(0, 12);
  }, [groups]);

  const [selectedId, setSelectedId] = useState<string | null>(candidates[0]?.a.id ?? null);
  const [score, setScore] = useState(85);

  const simulated = useMemo(() => {
    if (!selectedId) return null;
    const next = groups.map((g) => {
      const idx = g.assignments.findIndex((a) => a.id === selectedId);
      if (idx < 0) return g;
      const pcts = [...g.pcts];
      pcts[idx] = score;
      return { ...g, pcts };
    });
    return overallOf(next);
  }, [groups, selectedId, score]);

  if (!hasWeights) {
    return (
      <div className="rounded-2xl border border-nova-400/10 bg-nebula-900/60 px-5 py-4">
        <p className="text-sm font-semibold text-star-100">What-If Simulator</p>
        <p className="mt-1 text-xs leading-relaxed text-stardust-300">
          Category weights for this class aren&apos;t captured yet — the simulator
          unlocks once the next sync brings them in.
        </p>
      </div>
    );
  }

  const sel = candidates.find((c) => c.a.id === selectedId);
  const base = baseline ?? currentGrade;

  return (
    <div className="card-living rounded-2xl border border-nova-400/20 px-5 py-4">
      <h3 className="text-sm font-bold text-star-100">What-If Simulator</h3>
      <p className="mt-0.5 text-xs text-stardust-300">
        Pick an assignment, slide the score — watch your estimated grade move.
      </p>

      {candidates.length > 0 ? (
        <>
          <label className="mt-3 block">
            <span className="text-xs text-stardust-300">Assignment</span>
            <select
              value={selectedId ?? ""}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setScore(85);
              }}
              className="input-rooted mt-1 w-full rounded-xl px-3 py-2 text-sm"
            >
              {candidates.map((c) => (
                <option key={c.a.id} value={c.a.id}>
                  {cleanTitle(c.a.title)} — {c.cat} ({c.pct.toFixed(0)}% now)
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="mb-1 flex items-center justify-between text-xs text-stardust-300">
              <span>New score</span>
              <span className="font-bold tabular-nums text-aurum-300">{score}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full accent-nova-400"
              aria-label="Simulated score"
            />
          </label>

          {base != null && simulated != null && (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-nebula-800/60 px-4 py-3">
              <div className="text-center">
                <p className="text-lg font-bold tabular-nums text-stardust-300">{base.toFixed(1)}</p>
                <p className="text-[10px] text-stardust-400 capitalize">Now</p>
              </div>
              <span className="text-nova-300" aria-hidden="true">→</span>
              <div className="text-center">
                <p className={`text-lg font-bold tabular-nums ${simulated >= base ? "text-comet-300" : "text-stardust-100"}`}>
                  {simulated.toFixed(1)}
                </p>
                <p className="text-[10px] text-stardust-400 capitalize">What-If</p>
              </div>
              <p className={`ml-auto text-sm font-bold tabular-nums ${simulated - base >= 0 ? "text-comet-300" : "text-red-300"}`}>
                {simulated - base >= 0 ? "+" : ""}{(simulated - base).toFixed(1)} pts
              </p>
            </div>
          )}
          {sel && weights && (
            <p className="mt-2 text-[11px] text-stardust-400">
              {sel.cat} counts {weights[sel.cat] ?? "?"}% of your grade — that&apos;s
              why {sel.pct < 70 ? "recovering it moves the needle fast" : "every point here counts"}.
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs text-stardust-300">
          No scored assignments to simulate against yet.
        </p>
      )}
    </div>
  );
}
