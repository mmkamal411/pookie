// Client-side grade helpers. Per MODULE-ARCHITECTURE.md §0.6:
// letters are NEVER stored in the DB (numeric only); letterGrade() computes
// them from the numeric grade + the child's grade_scale. This module is
// client-safe — no server imports, so any component can use it.

/** Letter scale as stored on children.grade_scale: { A: [90, 100], ... } */
export type GradeScale = Record<string, [number, number]>;

/** Cobb official scale — the DEFAULT in migration 001; ParentVUE shows numeric only. */
export const COBB_GRADE_SCALE: GradeScale = {
  A: [90, 100],
  B: [80, 89],
  C: [74, 79],
  D: [70, 73],
  F: [0, 69],
};

/** Numeric grade → letter per the child's scale. "—" when ungraded. */
export function letterGrade(
  numeric: number | null | undefined,
  scale: GradeScale = COBB_GRADE_SCALE,
): string {
  if (numeric == null || Number.isNaN(numeric)) return "—";
  for (const [letter, [low, high]] of Object.entries(scale)) {
    if (numeric >= low && numeric <= high) return letter;
  }
  return numeric > 100 ? "A" : "F";
}

/** Points still to climb to reach the 90% goal. 0 once at/above 90; null when ungraded. */
export function gapTo90(numeric: number | null | undefined): number | null {
  if (numeric == null || Number.isNaN(numeric)) return null;
  return Math.max(0, 90 - numeric);
}

/** Color band: green ≥90 · yellow 80–89 · orange 70–79 · red <70. */
export type GradeBand = "green" | "yellow" | "orange" | "red";

export function gradeBand(numeric: number | null | undefined): GradeBand {
  if (numeric == null || Number.isNaN(numeric)) return "yellow";
  if (numeric >= 90) return "green";
  if (numeric >= 80) return "yellow";
  if (numeric >= 70) return "orange";
  return "red";
}
