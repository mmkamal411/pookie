"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Global error boundary — the last resort when a page crashes.
 *
 * Offers two recoveries: reload (transient errors) and "start over"
 * (the self-service escape hatch for a registration gone bad — the user
 * lands on /login with the account-deletion flow one tap away in
 * Settings, or can sign in fresh if they already deleted).
 *
 * This replaces the blank Cloudflare Pages error page with something
 * the user can act on instead of staring at.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Intentionally not console.log'd (code cleanliness rule) — the
    // digest is shown to the user for support reference.
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-nebula-950">
        <main className="flex min-h-screen min-h-dvh items-center justify-center px-6">
          <div className="card-living w-full max-w-md rounded-3xl p-8 text-center">
            <p className="text-4xl" aria-hidden="true">
              🛸
            </p>
            <h1 className="text-sunlit mt-4 text-2xl font-semibold">
              Something Went Wrong
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stardust-300">
              Pookie ran into a problem loading this page. This is usually
              temporary — try again, and if it keeps happening, starting
              fresh often fixes it.
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-stardust-400">
                Reference: {error.digest}
              </p>
            )}
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={reset}
                className="btn-dapple w-full rounded-2xl py-3 text-sm font-semibold text-nebula-950"
              >
                Try Again
              </button>
              <Link
                href="/login"
                className="block w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-medium text-white/85 transition hover:border-white/30"
              >
                Start Fresh
              </Link>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-stardust-400">
              Starting fresh signs you out and back in. If your account
              seems stuck, you can delete it from Settings → Profile
              once you&apos;re back in.
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
