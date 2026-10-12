"use client";

import type { FormulaBrief } from "@/server/services/school";

/**
 * Formula of the day — ported from d-dash's SAT formula card.
 * One verified formula from the formula bank, rotated daily.
 */
export function FormulaCard({ formula }: { formula: FormulaBrief | null }) {
  if (!formula) return null;

  return (
    <div className="rounded-2xl border border-nova-400/15 bg-nebula-800/30 px-5 py-4">
      <p className="text-xs font-medium tracking-[0.14em] text-nova-300 uppercase">
        {formula.subject === "math" ? "Math" : "Science"} · formula of the day
      </p>
      <p className="mt-2 text-sm font-semibold text-star-100">{formula.name}</p>
      <p className="readout mt-1 text-sm leading-relaxed text-stardust-200">
        {formula.plain_statement}
      </p>
    </div>
  );
}
