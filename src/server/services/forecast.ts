// Path-to-90 forecast engine — forecast.v1.0
//
// DETERMINISTIC, VERSIONED, INPUT-CITED. The LLM never computes grades.
// This module is a PURE function: same inputs → same outputs, no I/O, no
// randomness, no Date.now() inside the math. Citations (sources + timestamps)
// are supplied by the caller and echoed into the output.
//
// Algorithm (sol-school-ai §1.2):
//   for each category c:
//     avg_c = earned_c / possible_c        (possible_c = 0 → excluded, flagged)
//     weights must sum to 1.0 ± 0.001 or the engine REFUSES (invalid inputs)
//   completed_points  = Σ avg_c * w_c            (categories with graded work)
//   remaining_weight  = 1 - Σ w_c                (categories with graded work)
//   required_avg_on_remaining = (0.90 - completed_points) / remaining_weight
//   remaining_weight <= 0        → "final" path (grade is final)
//   required > 1.0               → "out-of-reach" path
//   else per remaining assessment a (max points p_a, category c):
//     marginal_impact_a = (p_a / possible_remaining_in_c) * w_c
//     what_if_table[a] = projected grade at scores 70/80/90/100 on a
//
// Versioning: MAJOR = algorithm change, MINOR = bugfix/tuning. Every forecast
// row stores engine_version + inputs_hash + computed_at. A version bump
// requires golden-fixture regeneration review by the math expert.

export const FORECAST_ENGINE_VERSION = "forecast.v1.0";
export const FORECAST_TARGET = 0.9;

export interface CategoryInput {
  /** Category name, e.g. "Tests". Must be unique within the input. */
  name: string;
  /** Points earned in graded work. */
  earned: number;
  /** Points possible in graded work. 0 = no graded work yet (excluded, flagged). */
  possible: number;
  /** Category weight as a fraction, e.g. 0.4 for 40%. */
  weight: number;
}

export interface RemainingAssessment {
  name: string;
  /** Must match a CategoryInput.name. */
  category: string;
  maxPoints: number;
}

export interface InputCitation {
  input: string;
  source: string;
  takenAt: string; // ISO timestamp of the source snapshot
}

export interface ForecastInput {
  categories: CategoryInput[];
  remaining: RemainingAssessment[];
  citations: InputCitation[];
  /** Teen-set assumption when the gradebook lists no future work (fraction). */
  assumedRemainingWeight?: number;
  target?: number; // default 0.90 (the standing goal)
}

export type Reachability = "on-track" | "stretch" | "out-of-reach" | "final";

export interface WhatIfRow {
  assessment: string;
  category: string;
  maxPoints: number;
  /** Projected final grade (0..1) if the teen scores 70/80/90/100 on this item. */
  projectedGradeAt: { s70: number; s80: number; s90: number; s100: number };
  /** Exact points of final grade per point earned on this item. */
  marginalImpact: number;
}

export interface TopLever {
  assessment: string;
  marginalImpact: number;
  why: string;
}

export interface ForecastResult {
  engineVersion: string;
  inputsHash: string;
  target: number;
  /** Required average (0..1) on remaining work. null when the grade is final. */
  requiredAvgOnRemaining: number | null;
  reachability: Reachability;
  whatIf: WhatIfRow[];
  topLevers: TopLever[];
  /** Categories with zero possible points — excluded from the math, flagged. */
  excludedCategories: string[];
  citations: InputCitation[];
  invalidReason?: string;
}

const WEIGHT_TOLERANCE = 0.001;

/** Canonical JSON for hashing: sorted keys, fixed float precision. */
function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? value.toPrecision(12) : "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
  }
  return "null";
}

export async function hashForecastInputs(input: ForecastInput): Promise<string> {
  const canonical = canonicalize({
    categories: input.categories,
    remaining: input.remaining,
    assumedRemainingWeight: input.assumedRemainingWeight ?? null,
    target: input.target ?? FORECAST_TARGET,
  });
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export async function computeForecast(input: ForecastInput): Promise<ForecastResult> {
  const target = input.target ?? FORECAST_TARGET;
  const inputsHash = await hashForecastInputs(input);
  const base = {
    engineVersion: FORECAST_ENGINE_VERSION,
    inputsHash,
    target,
    citations: input.citations,
  };

  // --- validation (fail-closed: refuse rather than guess) ---
  const weightSum = input.categories.reduce((s, c) => s + c.weight, 0);
  if (input.categories.length === 0) {
    return { ...base, requiredAvgOnRemaining: null, reachability: "final", whatIf: [], topLevers: [], excludedCategories: [], invalidReason: "no_categories" };
  }
  if (Math.abs(weightSum - 1) > WEIGHT_TOLERANCE) {
    return { ...base, requiredAvgOnRemaining: null, reachability: "final", whatIf: [], topLevers: [], excludedCategories: [], invalidReason: `weights_sum_${round4(weightSum)}_not_1` };
  }
  const names = new Set<string>();
  for (const c of input.categories) {
    if (names.has(c.name)) {
      return { ...base, requiredAvgOnRemaining: null, reachability: "final", whatIf: [], topLevers: [], excludedCategories: [], invalidReason: "duplicate_category" };
    }
    names.add(c.name);
    if (c.weight < 0 || c.earned < 0 || c.possible < 0) {
      return { ...base, requiredAvgOnRemaining: null, reachability: "final", whatIf: [], topLevers: [], excludedCategories: [], invalidReason: "negative_input" };
    }
  }

  const graded = input.categories.filter((c) => c.possible > 0);
  const excludedCategories = input.categories.filter((c) => c.possible <= 0).map((c) => c.name);

  const avgOf = (c: CategoryInput) => c.earned / c.possible;
  const completedPoints = graded.reduce((s, c) => s + avgOf(c) * c.weight, 0);
  const gradedWeight = graded.reduce((s, c) => s + c.weight, 0);
  let remainingWeight = 1 - gradedWeight;

  // Known remaining assessments adjust the remaining-weight picture: their
  // weight is bounded by the categories they belong to, so remainingWeight
  // stays as computed; the per-item table below carries the marginal impact.
  if (input.assumedRemainingWeight != null && input.remaining.length === 0) {
    remainingWeight = Math.min(Math.max(input.assumedRemainingWeight, 0), 1);
  }

  if (remainingWeight <= 0) {
    // Grade is final: everything graded, nothing left to earn.
    return { ...base, requiredAvgOnRemaining: null, reachability: "final", whatIf: [], topLevers: [], excludedCategories };
  }

  const requiredAvgOnRemaining = (target - completedPoints) / remainingWeight;

  if (requiredAvgOnRemaining > 1) {
    // Mathematically out of reach via remaining work — the planner path is
    // makeup/extra credit (never fabricated points); surfaced by the caller.
    return {
      ...base,
      requiredAvgOnRemaining: round4(requiredAvgOnRemaining),
      reachability: "out-of-reach",
      whatIf: [],
      topLevers: [],
      excludedCategories,
    };
  }

  // --- what-if table + marginal impacts ---
  const byCategory = new Map<string, CategoryInput>();
  for (const c of input.categories) byCategory.set(c.name, c);

  const remainingByCat = new Map<string, number>();
  for (const a of input.remaining) {
    remainingByCat.set(a.category, (remainingByCat.get(a.category) ?? 0) + a.maxPoints);
  }

  const whatIf: WhatIfRow[] = [];
  for (const a of input.remaining) {
    const cat = byCategory.get(a.category);
    if (!cat) continue; // unknown category: skip (never guess the weight)
    const denom = remainingByCat.get(a.category) ?? 0;
    const marginalImpact = denom > 0 ? (a.maxPoints / denom) * cat.weight : 0;

    const project = (scorePct: number): number => {
      // Project final grade if the teen scores scorePct (0..100) on this item.
      let total = completedPoints;
      for (const c of input.categories) {
        if (c.name !== a.category) continue;
        const newAvg = (c.earned + (scorePct / 100) * a.maxPoints) / (c.possible + a.maxPoints);
        total = total - (c.possible > 0 ? avgOf(c) * c.weight : 0) + newAvg * c.weight;
      }
      return round4(Math.min(Math.max(total, 0), 1.05));
    };

    whatIf.push({
      assessment: a.name,
      category: a.category,
      maxPoints: a.maxPoints,
      projectedGradeAt: { s70: project(70), s80: project(80), s90: project(90), s100: project(100) },
      marginalImpact: round4(marginalImpact),
    });
  }

  // Top-3 levers: ranked by marginal impact × feasibility. Feasibility uses
  // only school-of-record facts (weight, points) — never LLM judgment.
  const topLevers: TopLever[] = [...whatIf]
    .sort((x, y) => y.marginalImpact - x.marginalImpact)
    .slice(0, 3)
    .map((w) => ({
      assessment: w.assessment,
      marginalImpact: w.marginalImpact,
      why: `${w.maxPoints} pts in ${w.category} — each point earned moves the final grade by ${(w.marginalImpact / w.maxPoints).toFixed(4)}`,
    }));

  const reachability: Reachability =
    requiredAvgOnRemaining <= target ? "on-track" : "stretch";

  return {
    ...base,
    requiredAvgOnRemaining: round4(requiredAvgOnRemaining),
    reachability,
    whatIf,
    topLevers,
    excludedCategories,
  };
}
