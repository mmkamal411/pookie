// Shared applet primitives — tenant/data hooks plus the two applet data
// states (loading / plain-English error). Every applet content component
// uses these so modules ALWAYS open: loading shimmer first, content when
// ready, a friendly retry card on failure. Never a blank page, never a
// dead tap (NO BLANK PAGES rule, Mehedi 2026-10-12).

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTenant } from "@/components/tenant-provider";
import { getHealthContext } from "@/lib/health/actions";
import type { HealthContext } from "@/lib/health/types";
import { getAppletSquad5 } from "@/lib/applet-actions";
import type { Squad5Context } from "@/lib/squad5/context";

export interface AppletTenant {
  childId: string;
  childSlug: string;
  childName: string;
  /** "parent" | "child" — the viewer's membership role. */
  role: "parent" | "child";
}

/** Tenant facts for the active child, from the child layout's provider. */
export function useAppletTenant(): AppletTenant {
  const { activeChild, activeChildId, memberships } = useTenant();
  const membership =
    memberships.find((m) => m.child_id === activeChildId) ?? memberships[0] ?? null;
  const child = activeChild ?? membership?.child ?? null;
  return {
    childId: membership?.child_id ?? "",
    childSlug: child?.slug ?? "",
    childName: child?.nickname ?? child?.first_name ?? "Your child",
    role: membership?.role === "child" ? "child" : "parent",
  };
}

export function useHealthCtx(childId: string): {
  ctx: HealthContext | null;
  failed: boolean;
  retry: () => void;
} {
  const [ctx, setCtx] = useState<HealthContext | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    // No child yet (logged-out edge) — the failed flag is derived below,
    // no synchronous setState in the effect body.
    if (!childId) return;
    let live = true;
    getHealthContext(childId).then(
      (res) => {
        if (!live) return;
        if (res.ok) setCtx(res.data);
        else setFailed(true);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [childId, nonce]);
  return { ctx, failed: failed || !childId, retry: () => setNonce((n) => n + 1) };
}

export function useSquad5Ctx(childSlug: string): {
  s5: Squad5Context | null;
  failed: boolean;
  retry: () => void;
} {
  const [s5, setS5] = useState<Squad5Context | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    // No slug yet — the failed flag is derived below, no synchronous
    // setState in the effect body.
    if (!childSlug) return;
    let live = true;
    getAppletSquad5(childSlug).then(
      (v) => {
        if (!live) return;
        if (v) setS5(v);
        else setFailed(true);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [childSlug, nonce]);
  return { s5, failed: failed || !childSlug, retry: () => setNonce((n) => n + 1) };
}

/** Loading shimmer shown while the applet resolves its server context. */
export function AppletLoading({ label }: { label: string }) {
  return (
    <div className="space-y-3 p-1" role="status" aria-label={`Loading ${label}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.04] p-4"
        >
          <div className="h-3 w-2/5 rounded-full bg-white/10" />
          <div className="mt-2.5 h-3 w-4/5 rounded-full bg-white/[0.07]" />
        </div>
      ))}
      <p className="sr-only">Loading {label}…</p>
    </div>
  );
}

/**
 * Plain-English error card (grandmother test — Mehedi 2026-10-12).
 * Every applet failure lands here with a retry path, never a blank page.
 */
export function AppletError({
  label,
  onRetry,
}: {
  label: string;
  onRetry: () => void;
}) {
  return (
    <div className="p-1">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
        <p aria-hidden="true" className="text-3xl">
          🛰️
        </p>
        <p className="mt-3 text-base font-semibold text-star-100">Something Went Wrong</p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-stardust-300">
          {label} didn&apos;t load. Your work is safe — try again and it should pick right up.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl border border-nova-400/40 bg-nova-500/15 px-5 py-2.5 text-sm font-medium text-star-100 transition-colors hover:bg-nova-500/25"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

/** Resolve-then-render helper: loading → error → content. */
export function AppletGate({
  label,
  loading,
  failed,
  onRetry,
  children,
}: {
  label: string;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (failed) return <AppletError label={label} onRetry={onRetry} />;
  if (loading) return <AppletLoading label={label} />;
  return <>{children}</>;
}
