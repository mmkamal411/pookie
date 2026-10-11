// W5 honesty helpers — the non-negotiable rules as code.
// 1. Selectivity is ALWAYS a dated, cited stat (college_stats.as_of/source),
//    shown as a band or point the source published — never a probability.
// 2. Stats not yet loaded (P2 ETL pending) render as "not yet available",
//    never as zeros or guesses.
// 3. Deadline reminder buckets are derived (30/14/7/2 days), never stored.

import type { CollegeRegion, CollegeStat, DeadlineKind } from "./types";

export const REGION_LABELS: Record<CollegeRegion, string> = {
  ga_instate: "Georgia",
  southeast: "Southeast",
  national_premed: "National pre-med",
};

export const DEADLINE_KIND_LABELS: Record<DeadlineKind, string> = {
  early_action: "Early Action",
  early_decision: "Early Decision",
  early_decision_2: "Early Decision II",
  regular: "Regular Decision",
  rolling: "Rolling",
  scholarship: "Scholarship",
  fafsa: "FAFSA",
  css_profile: "CSS Profile",
  other: "Other",
};

export const RELEASE_DOCUMENT_LABELS: Record<string, string> = {
  official_transcript: "Official transcript",
  midyear_report: "Midyear report",
  final_transcript: "Final transcript",
  other: "Other document",
};

/** Stat keys the explorer renders as 25th–75th bands (never point estimates). */
const BAND_KEYS: Record<string, [string, string]> = {
  sat: ["sat_25", "sat_75"],
  act: ["act_25", "act_75"],
};

export interface StatBand {
  lo: number;
  hi: number;
  as_of: string;
  source: string;
}

/** Pull a 25th–75th band for a stat family from a college's stat rows. */
export function statBand(stats: CollegeStat[], family: "sat" | "act"): StatBand | null {
  const [loKey, hiKey] = BAND_KEYS[family];
  const lo = stats.find((s) => s.stat_key === loKey);
  const hi = stats.find((s) => s.stat_key === hiKey);
  if (!lo || !hi) return null;
  return { lo: lo.stat_value, hi: hi.stat_value, as_of: lo.as_of, source: lo.source };
}

/** Single dated, cited stat value (e.g. acceptance_rate). Null when not loaded. */
export function statPoint(
  stats: CollegeStat[],
  key: string,
): { value: number; as_of: string; source: string } | null {
  const s = stats.find((x) => x.stat_key === key);
  return s ? { value: s.stat_value, as_of: s.as_of, source: s.source } : null;
}

/**
 * Reminder bucket for a deadline: the 30/14/7/2-day escalation from the
 * vision doc. Null when done, past, or more than 30 days out.
 */
export function reminderBucket(dueAt: string, done: boolean): 30 | 14 | 7 | 2 | null {
  if (done) return null;
  const ms = new Date(dueAt).getTime() - Date.now();
  if (Number.isNaN(ms) || ms < 0) return null;
  const days = ms / 86_400_000;
  if (days <= 2) return 2;
  if (days <= 7) return 7;
  if (days <= 14) return 14;
  if (days <= 30) return 30;
  return null;
}

/** Whole days until a deadline (negative = overdue). */
export function daysUntil(dueAt: string): number {
  return Math.floor((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
}

export const HONESTY_BANNER =
  "Selectivity numbers come from dated, cited sources and describe past " +
  "admitted classes — never your chances. Statistics not yet loaded are " +
  "marked as such, never guessed. Verify every number on the college's own " +
  "site before deciding.";

/**
 * Copy blocklist for scripts/copy-lint-college.sh. Any W5 UI/API copy matching
 * these patterns fails CI — the no-guarantee rule is enforced, not suggested.
 */
export const COPY_BLOCKLIST: RegExp[] = [
  /guarantee[ds]?/i, // "guaranteed admission", "we guarantee"
  /shoo-?in/i,
  /will get in/i,
  /\bcertain admission\b/i,
  /\bassured admission\b/i,
  /\d+\s*%\s*chance/i, // "80% chance of admission"
  /chance of (admission|acceptance|getting in)/i,
  /probability of (admission|acceptance)/i,
  /your odds/i,
  /safety school/i, // implies a guarantee; describe selectivity instead
  /lock it in/i,
];
