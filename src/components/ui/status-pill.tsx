// StatusPill — user-facing status chip for tickets, grants, and module
// states. Maps server states to plain-language pill copy + tone.
//
// Ticket mapping (UX-SPECS §6.2):
//   open        → "Open" (slate)
//   in_progress → "With [name]" / "With our team" (teal glow)
//   resolved    → "Answered — your call" (amber)
//   closed      → "Closed" (dim)
// Grant mapping: pending / active / expired / denied / revoked.

import type { ReactNode } from "react";

const TONES: Record<string, string> = {
  slate: "border-stardust-500/30 bg-stardust-500/10 text-stardust-300",
  teal: "border-teal-400/40 bg-teal-500/12 text-teal-200 shadow-[0_0_10px_rgb(45_212_191/0.2)]",
  amber: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  dim: "border-stardust-500/20 bg-nebula-900/60 text-stardust-400",
  red: "border-red-400/40 bg-red-500/10 text-red-200",
  green: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
};

export function StatusPill({
  tone = "slate",
  children,
  title,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** UX-SPECS §6.2 ticket-status → pill mapping. */
export function ticketPill(status: string, agentName?: string | null): { tone: keyof typeof TONES; label: string } {
  switch (status) {
    case "open":
      return { tone: "slate", label: "Open" };
    case "in_progress":
      return { tone: "teal", label: agentName ? `With ${agentName}` : "With our team" };
    case "resolved":
      return { tone: "amber", label: "Answered — your call" };
    case "closed":
      return { tone: "dim", label: "Closed" };
    default:
      return { tone: "slate", label: status };
  }
}
