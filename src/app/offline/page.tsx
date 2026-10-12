import type { Metadata } from "next";

/**
 * Squad Mobile 2026-10-12 — the offline shell.
 *
 * Served by the service worker when a navigation fails with no network.
 * Never a blank page: a calm cosmic "signal lost" view with a retry.
 * This page is cached at SW install, so it renders with zero network.
 */

export const metadata: Metadata = {
  title: "Signal Lost — Pookie",
  description: "You're offline. Pookie is holding your place.",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      {/* The orb, waiting patiently */}
      <div
        aria-hidden="true"
        className="relative mb-8 h-28 w-28 animate-breathe rounded-full"
        style={{
          background:
            "radial-gradient(circle at 38% 34%, #fffbeacc 0%, #fde68a66 22%, #4ade8055 48%, #22d3ee44 72%, #0b0b1ecc 100%)",
          boxShadow:
            "0 0 32px rgb(254 243 199 / 0.5), 0 0 100px rgb(74 222 128 / 0.25)",
        }}
      />
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-nova-300">
        Signal Lost
      </p>
      <h1 className="mt-3 max-w-sm text-2xl font-bold text-star-100">
        The ship drifted out of range
      </h1>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-stardust-200">
        You&apos;re offline, so Pookie can&apos;t reach your data right now.
        Your place is held — reconnect and everything picks up where you left
        off.
      </p>
      <a
        href="/"
        className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-comet-500/40 bg-comet-500/15 px-8 text-sm font-semibold text-comet-300 shadow-glow-sm transition active:scale-95"
      >
        Try Again
      </a>
      <p className="mt-6 text-xs text-stardust-500">
        Pookie is still here, hovering, waiting for your signal.
      </p>
    </main>
  );
}
