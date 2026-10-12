// BottomSheet — the Nebula popup container. Slides up from the bottom with
// a starlit drag handle, a glowing top edge, and a dimmed cosmos backdrop.
// The "More" tab popup and every menu-level sheet render through this.
//
// Props:
//   open       — mount/unmount the sheet
//   onClose    — called on backdrop tap or Escape; MUST close the sheet
//   title      — sheet heading (aria-label)
//   subtitle   — one line under the heading
//   children   — scrollable sheet body
//   maxWidth   — Tailwind max-w class for the sheet (default max-w-2xl)
// Behavior: locks body scroll while open; Escape dismisses; backdrop tap
// dismisses. Content region scrolls independently (max 88dvh).

"use client";

import { useEffect, type ReactNode } from "react";

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  // z-[100]: modal sheets must sit above ALL fixed chrome — the console
  // toolbar (z-40), the ambient pinball layer (z-[60]), and toasts (z-40).
  // A sheet's Close button must never be occluded by the docked orb.
  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#050510]/75 backdrop-blur-sm"
      />
      <div
        className={`animate-rise module-dock-panel absolute inset-x-0 bottom-0 mx-auto w-full ${maxWidth} overflow-hidden rounded-t-[28px]`}
        style={{
          maxHeight: "88dvh",
          background: "linear-gradient(180deg, rgb(28 28 64 / 0.98), rgb(8 8 22 / 0.99))",
        }}
      >
        <div className="flex justify-center pt-3" aria-hidden="true">
          <span className="h-1.5 w-12 rounded-full bg-nova-400/50 shadow-[0_0_12px_rgb(244_114_182/0.6)]" />
        </div>
        {/* Docking-module eyebrow — the sheet is a module docked with the console. */}
        <div className="flex items-center gap-2 px-5 pt-3" aria-hidden="true">
          <span className="module-dock-dot" />
          <span className="module-dock-eyebrow">Docked module</span>
        </div>
        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-1">
          <div>
            <h2 className="text-sunlit text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-stardust-300">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-nova-400/25 bg-nebula-900/70 text-lg text-stardust-300 transition-colors hover:border-nova-400/50 hover:text-nova-300"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="overflow-y-auto px-5 pt-2 pb-8" style={{ maxHeight: "calc(88dvh - 110px)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
