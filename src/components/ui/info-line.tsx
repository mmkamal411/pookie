// InfoLine — a single honest informational line: soft tinted panel with an
// icon and plain-language text. Used for gate notes, disclaimers, and
// growth-framing copy across Travel, Marketplace, and Support.
//
// Props:
//   tone     — "info" (default, stardust) | "amber" (caution) | "teal" (trust)
//   icon     — leading glyph (default per tone)
//   children — the copy (≤8th-grade, shame-free)

import type { ReactNode } from "react";

const TONES: Record<string, { wrap: string; icon: string }> = {
  info: {
    wrap: "border-stardust-500/20 bg-stardust-500/5 text-stardust-200",
    icon: "ℹ️",
  },
  amber: {
    wrap: "border-amber-400/25 bg-amber-500/8 text-amber-100",
    icon: "⚠️",
  },
  teal: {
    wrap: "border-teal-400/25 bg-teal-500/8 text-teal-100",
    icon: "🛡️",
  },
};

export function InfoLine({
  tone = "info",
  icon,
  children,
  className = "",
}: {
  tone?: keyof typeof TONES;
  icon?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = TONES[tone] ?? TONES.info;
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed ${t.wrap} ${className}`}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        {icon ?? t.icon}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
