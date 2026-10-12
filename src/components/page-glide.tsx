"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * How long the outgoing view lingers (ms) — matches .page-glide-out.
 * Squad Glide: the ship gliding from one view to the next.
 */
const GLIDE_OUT_MS = 250;

type HeldView = { node: ReactNode; key: string };

/**
 * PageGlide — the ride. Every navigation is a smooth glide, never a cut.
 *
 * On pathname change the PREVIOUS view is held for 250ms as an
 * absolutely-positioned overlay that fades and drifts out, while the new
 * view glides in beneath it (fade + gentle rise/settle, 350ms). The
 * GlassPane viewscreen stays stable; the view changes within it.
 *
 * The held view is a visual echo only: inert, aria-hidden, and
 * pointer-events-free, so it can never intercept taps or trap focus.
 * `prefers-reduced-motion` skips the hold entirely (instant swap) via the
 * matchMedia guard here and the global CSS kill-switch.
 *
 * GPU-cheap: opacity/transform animations only, zero re-renders of the
 * incoming tree, and the echo is cleared by timer (no lingering DOM).
 */
export default function PageGlide({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [leaving, setLeaving] = useState<HeldView | null>(null);
  const prev = useRef<{ pathname: string; node: ReactNode } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const last = prev.current;
    prev.current = { pathname, node: children };
    // First mount, or a re-render without navigation — nothing to glide out.
    if (!last || last.pathname === pathname) return;

    // Reduced motion: instant swap, no echo.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    if (timer.current) clearTimeout(timer.current);
    setLeaving({ node: last.node, key: last.pathname });
    timer.current = setTimeout(() => setLeaving(null), GLIDE_OUT_MS);
  }, [pathname, children]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return (
    <div className="page-glide-wrap">
      <div key={pathname} className="page-glide">
        {children}
      </div>
      {leaving && (
        <div
          key={`glide-out-${leaving.key}`}
          className="page-glide-out"
          aria-hidden="true"
          inert
        >
          {leaving.node}
        </div>
      )}
    </div>
  );
}
