// Category weights — real for 4 classes, estimated for 2.
// (2026-10-05 StudentVUE sweep.) Keys are curated class slugs.

export const CATEGORY_WEIGHTS: Record<string, Record<string, number>> = {
  apcsp: { Final: 10, Lab: 15, Project: 35, Quiz: 15, Test: 25 },
  envsci: { "Class Activity": 10, "Final Exam": 10, Labs: 15, Projects: 15, Quizzes: 10, Tests: 40 },
  chinese: { Assessment: 50, "Classwork/Homework": 40, Final: 10 },
  gov: { "Final Exam": 10, "Homework/Daily Work": 25, Quizzes: 25, Tests: 40 },
  geometry: { Homework: 13, Quizzes: 32, Tests: 55 },
  litcomp: { Classwork: 10, Homework: 25, Projects: 40, Quizzes: 25 },
};

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Match a raw category string to a weighted category name for the class. */
export function matchWeight(
  slug: string,
  rawCategory: string
): { name: string; weight: number } | null {
  const weights = CATEGORY_WEIGHTS[slug];
  if (!weights) return null;
  const n = normKey(rawCategory).replace(/classwk/g, "classwork");
  const keys = Object.keys(weights);
  const sing = (s: string) => s.replace(/s\b/g, "");
  for (const k of keys) if (normKey(k) === n) return { name: k, weight: weights[k] };
  for (const k of keys) if (sing(normKey(k)) === sing(n)) return { name: k, weight: weights[k] };
  for (const k of [...keys].sort((a, b) => b.length - a.length)) {
    const kn = normKey(k);
    if (kn && (kn.includes(n) || n.includes(kn))) return { name: k, weight: weights[k] };
  }
  return null;
}

/** Clean a raw worker category like "30 minutes to complete | Class Activity". */
export function cleanCategory(category: string | null): string {
  const c = (category || "").trim();
  if (!c) return "Uncategorized";
  const parts = c.split("|").map((p) => p.trim()).filter(Boolean);
  const last = parts.length > 0 ? parts[parts.length - 1] : c;
  const colonParts = last.split(":").map((p) => p.trim()).filter(Boolean);
  return colonParts.length > 0 ? colonParts[colonParts.length - 1] : "Uncategorized";
}
