// LegalAccordion — the §4.4 contract, built exactly.
// Collapsed by default. Badge ∈ Required by law | Our choice | Law + our
// choice. our_choice MUST show the honesty line ("The law doesn't require
// this — we do it because …"). Stale accordions (past review_due_at) show
// the amber "being re-reviewed" banner and are never hidden.
// Attorney sign-off gate (§E.1) is enforced in the CMS, not the client.

"use client";

import { useState } from "react";
import { Badge, InfoLine } from "@/components/ui";

export type LegalBasis = "law_required" | "our_choice" | "both";

const BADGE: Record<LegalBasis, { label: string; tone: "law" | "choice" }> = {
  law_required: { label: "Required by law", tone: "law" },
  our_choice: { label: "Our choice", tone: "choice" },
  both: { label: "Law + our choice", tone: "law" },
};

export function LegalAccordion({
  basis,
  citation,
  noteMd,
  reviewedAt,
  reviewDueAt,
  version,
  stale,
}: {
  basis: LegalBasis;
  citation: string | null;
  noteMd: string | null;
  reviewedAt: string | null;
  reviewDueAt: string | null;
  version: number;
  stale: boolean;
}) {
  const [open, setOpen] = useState(false);
  const badge = BADGE[basis];

  return (
    <div className="overflow-hidden rounded-xl border border-amber-400/25 bg-amber-500/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
      >
        <span className="text-sm font-medium text-star-100">
          <span aria-hidden="true">⚖️ </span>Why does Pookie do it this way?
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <span aria-hidden="true" className={`text-amber-300 transition-transform ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-amber-400/15 px-3.5 py-3 text-sm leading-relaxed text-stardust-200">
          {stale && (
            <InfoLine tone="amber">
              This explanation is being re-reviewed — the policy hasn&apos;t changed.
            </InfoLine>
          )}
          {noteMd && (
            <div className="whitespace-pre-line">{noteMd}</div>
          )}
          {citation && (
            <p className="text-[13px]">
              <strong className="text-star-100">The law:</strong> {citation}
            </p>
          )}
          {basis === "our_choice" && (
            <p className="rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-[13px]">
              The law doesn&apos;t require this — we do it because it&apos;s the right way to
              treat the people who trust us.
            </p>
          )}
          <p className="text-xs text-stardust-500">
            Reviewed {reviewedAt ?? "—"} · Next review {reviewDueAt ?? "—"} · v{version}
          </p>
        </div>
      )}
    </div>
  );
}
