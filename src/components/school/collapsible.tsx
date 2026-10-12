"use client";

import { useRef, useState } from "react";

/**
 * Collapsible section — the overview's workhorse. Collapsed by default,
 * Title Case titles, cool neon glow. Smooth height animation; scrolls into
 * view on expand.
 */
export function Collapsible({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    }
  }

  return (
    <div ref={ref} className="card-living scroll-mt-4 overflow-hidden rounded-2xl border border-nova-400/15">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-star-100">{title}</span>
          {subtitle && <span className="mt-0.5 block text-xs text-stardust-300">{subtitle}</span>}
        </span>
        <span
          className={`shrink-0 text-nova-300 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-nova-400/10 px-5 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
