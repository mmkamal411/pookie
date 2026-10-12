"use client";

import Link from "next/link";

/**
 * Scoped error boundary for the /c/[childSlug] segment.
 *
 * Unlike the global error page, this does NOT say "your account might be
 * in a bad state" and does NOT push toward account deletion. It offers
 * scoped recovery: try again, or back to home.
 */
export default function ChildSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const refId = error.digest ?? "unknown";
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl" aria-hidden="true">🛸</div>
      <h2 className="mt-4 text-xl font-semibold text-stardust-100">
        We couldn&apos;t load this dashboard
      </h2>
      <p className="mt-2 max-w-md text-sm text-stardust-400">
        Something went wrong loading this page. It might be temporary —
        try again, or head back home.
      </p>
      <p className="mt-3 text-xs text-stardust-500">
        Reference: {refId}
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm transition hover:bg-stardust-200"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-2xl border border-nova-400/20 bg-nebula-900/70 px-5 py-2.5 text-sm font-semibold text-stardust-200 transition hover:border-nova-400/40"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
