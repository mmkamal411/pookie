"use client";

import { useState } from "react";

/**
 * Collapsible section shell — per the founder's direction, information is
 * collapsed by default and expands on tap (not chunky). The header always
 * shows the section title plus a count badge so the glance still lands.
 */
export function OverviewSection({
  title,
  badge,
  defaultOpen = false,
  delay = 0,
  children,
}: {
  title: string;
  badge?: string | number | null;
  defaultOpen?: boolean;
  delay?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="animate-bloom" style={{ animationDelay: `${delay}s` }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${title} — ${open ? "collapse" : "expand"}`}
        className="flex w-full items-center justify-between gap-3 py-2 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">
            {title}
          </span>
          {badge != null && badge !== "" && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-nova-400/30 bg-nebula-800/60 px-2 text-xs font-semibold text-nova-300">
              {badge}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          className={`text-lg leading-none text-nova-300 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {open && <div className="animate-rise mt-3">{children}</div>}
    </section>
  );
}
