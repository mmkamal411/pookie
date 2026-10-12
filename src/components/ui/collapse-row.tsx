// CollapseRow — a collapsed-by-default expandable row (Nebula style).
// Information stays collapsed until tapped: shame-free, glanceable.
//
// Props:
//   title       — row heading
//   meta        — small right-side text (counts, chips, dates)
//   defaultOpen — open on mount (default false)
//   children    — expanded body

"use client";

import { useState, type ReactNode } from "react";

export function CollapseRow({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="neon-pipe overflow-hidden rounded-xl border border-nova-400/15 bg-nebula-900/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
      >
        <span className="min-w-0 text-sm font-medium text-star-100">{title}</span>
        <span className="flex shrink-0 items-center gap-2">
          {meta}
          <span
            aria-hidden="true"
            className={`text-nova-300 transition-transform ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </span>
      </button>
      {open && (
        <div className="border-t border-nova-400/10 px-3.5 py-3 text-sm leading-relaxed text-stardust-300">
          {children}
        </div>
      )}
    </div>
  );
}
