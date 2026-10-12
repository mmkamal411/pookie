"use client";

// Mission-control shell shared by the Sync Command Center tabs.
// Dark panel, neon edge, monospace telemetry eyebrow, live ship clock.

import { useEffect, useState } from "react";
import { Gear } from "./gear";

export function CommandShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const clock = now.toLocaleTimeString("en-US", { hour12: false });
  const datestamp = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <section aria-label={title} className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#04070f]/90 shadow-[0_0_40px_rgba(34,211,238,0.08)]">
      <header className="flex items-start justify-between gap-4 border-b border-cyan-300/10 bg-gradient-to-r from-cyan-500/10 via-transparent to-emerald-500/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <Gear active size={40} />
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-cyan-300/80">{eyebrow}</p>
            <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
            <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-xs text-cyan-200/70">
          <p className="text-base font-semibold text-cyan-100 tabular-nums">{clock}</p>
          <p className="text-white/40">{datestamp} · Local</p>
        </div>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/**
 * "Backend not wired up yet" panel — shown when the API answers 503
 * SERVICE_NOT_READY (service key unset or tables/RPCs never migrated).
 * Plain English, honest about the state, with a recovery path (retry —
 * the backend may come online after the pending setup is applied).
 * This is NOT an error to troubleshoot: nothing the user did is wrong.
 */
export function BackendUnavailable({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-cyan-300/25 bg-cyan-400/[0.04] px-5 py-6 text-center">
      <p className="text-sm font-semibold text-cyan-100">Not connected yet</p>
      <p className="mx-auto mt-1.5 max-w-md font-mono text-xs leading-relaxed text-white/55">{message}</p>
      <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-white/40">
        Nothing you did is wrong — the background setup for this part of the app
        is still in progress. It usually comes online on its own; you can also
        try again in a bit.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/20"
      >
        Try Again
      </button>
    </div>
  );
}

/** Honest error panel — never a blank page, never a "taking root" dead end. */
export function ConsoleError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-400/25 bg-rose-500/5 px-5 py-6 text-center">
      <p className="text-sm font-semibold text-rose-200">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md font-mono text-xs leading-relaxed text-white/50">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/20"
      >
        Retry Connection
      </button>
    </div>
  );
}
