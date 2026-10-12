// Badge — a small Nebula status pill. Tones:
//   info    — neutral stardust
//   live    — "Live" module marker (nova pink glow)
//   seedling— seedling marker (soft green)
//   law     — "Required by law" (amber)
//   choice  — "Pookie's choice" (violet)
//   warning — gentle caution
//   locked  — locked state (quiet, never alarming)
//
// Props:
//   tone      — one of the above (default "info")
//   children  — pill text
//   title     — optional tooltip (e.g. the full law citation)
//   icon      — optional leading glyph

import type { ReactNode } from "react";

const TONES: Record<string, string> = {
  info: "border-stardust-500/30 bg-stardust-500/10 text-stardust-300",
  live: "border-nova-400/40 bg-nova-500/15 text-nova-300 shadow-[0_0_10px_rgb(244_114_182/0.25)]",
  seedling: "border-emerald-400/35 bg-emerald-500/10 text-emerald-300",
  law: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  choice: "border-violet-400/40 bg-violet-500/10 text-violet-300",
  warning: "border-orange-400/40 bg-orange-500/10 text-orange-300",
  locked: "border-stardust-500/30 bg-nebula-900/60 text-stardust-400",
};

export function Badge({
  tone = "info",
  children,
  title,
  icon,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  title?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`pill-glow inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}
