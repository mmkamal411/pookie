"use client";

import type { ReactNode } from "react";

/**
 * PanelShell — the shared chrome for every opening-page panel.
 * One calm glass card: small readout eyebrow, plain-English title,
 * highlight ring when a nudge points at the panel.
 *
 * `bare` renders the same content as a borderless section — used inside
 * the single opening glass pane (Meheldi 2026-10-12 ~22:28: one pane,
 * weather + calendar visible, todo expands).
 */
export function PanelShell({
  eyebrow,
  title,
  highlighted,
  action,
  bare,
  children,
}: {
  eyebrow: string;
  title: string;
  highlighted?: boolean;
  action?: ReactNode;
  bare?: boolean;
  children: ReactNode;
}) {
  if (bare) {
    return (
      <section
        aria-label={title}
        className={`rounded-2xl px-1 py-1 transition-shadow ${
          highlighted ? "shadow-[0_0_28px_rgb(167_139_250/0.22)]" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.25em] text-stardust-400 uppercase">
              {eyebrow}
            </p>
            <h2 className="text-sunlit mt-1 text-lg font-semibold">{title}</h2>
          </div>
          {action}
        </div>
        <div className="mt-3">{children}</div>
      </section>
    );
  }
  return (
    <section
      aria-label={title}
      className={`rounded-3xl border bg-nebula-900/55 p-5 backdrop-blur-md transition-shadow ${
        highlighted
          ? "border-nova-400/60 shadow-[0_0_36px_rgb(167_139_250/0.25)]"
          : "border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.25em] text-stardust-400 uppercase">
            {eyebrow}
          </p>
          <h2 className="text-sunlit mt-1 text-lg font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Quiet error/empty line for panels — plain words, never a dead end. */
export function PanelNote({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-stardust-400">{children}</p>;
}
