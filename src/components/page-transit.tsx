"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * PageTransit — the black-hole transit effect (Meheldi 2026-10-12 ~22:28).
 *
 * Changing pages triggers a brief warp: a black-hole disc blooms from the
 * center with a purple/cyan accretion ring, then releases. Fast (≤600ms),
 * skippable (click or Escape cuts it short), and fully still under
 * prefers-reduced-motion (instant cut, no overlay).
 *
 * Mounted once in the root layout. It watches the pathname and plays over
 * the incoming page — the navigation itself is never delayed.
 */
export function PageTransit() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const prev = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (prev.current === null) {
      prev.current = pathname;
      return;
    }
    if (prev.current === pathname) return;
    prev.current = pathname;

    // Skip the effect entirely for reduced-motion pilots (instant cut).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setActive(true);
    const t = window.setTimeout(() => setActive(false), 560);
    timers.current.push(t);
    return () => {
      timers.current.forEach((x) => window.clearTimeout(x));
      timers.current = [];
    };
  }, [pathname]);

  // Skippable: click or Escape cuts the transit short.
  useEffect(() => {
    if (!active) return;
    const cut = () => setActive(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active ]);

  if (!active) return null;

  return (
    <>
      <div
        className="transit-overlay"
        onClick={() => setActive(false)}
        aria-hidden="true"
      >
        <div className="transit-hole" />
        <div className="transit-ring" />
      </div>
      <style>{TRANSIT_CSS}</style>
    </>
  );
}

const TRANSIT_CSS = `
.transit-overlay {
  position: fixed; inset: 0; z-index: 200;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  background: rgb(1 2 6 / 0.55);
  animation: transit-out 560ms ease forwards;
  cursor: pointer;
}
.transit-hole {
  position: absolute;
  width: 12vmin; height: 12vmin; border-radius: 9999px;
  background: radial-gradient(circle, #000 0%, #000 55%, transparent 72%);
  box-shadow: 0 0 60px 20px rgb(0 0 0 / 0.9);
  animation: transit-bloom 420ms cubic-bezier(0.3, 0.7, 0.4, 1) forwards;
}
.transit-ring {
  position: absolute;
  width: 16vmin; height: 16vmin; border-radius: 9999px;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgb(167 139 250 / 0.9) 60deg,
    rgb(34 211 238 / 0.9) 140deg,
    transparent 220deg,
    rgb(167 139 250 / 0.55) 300deg,
    transparent 360deg
  );
  -webkit-mask: radial-gradient(circle, transparent 58%, #000 60%, #000 68%, transparent 70%);
  mask: radial-gradient(circle, transparent 58%, #000 60%, #000 68%, transparent 70%);
  filter: blur(1px);
  animation: transit-spin-bloom 560ms cubic-bezier(0.3, 0.7, 0.4, 1) forwards;
}
@keyframes transit-bloom {
  from { transform: scale(0.4); opacity: 0; }
  40% { opacity: 1; }
  to { transform: scale(14); opacity: 1; }
}
@keyframes transit-spin-bloom {
  from { transform: scale(0.3) rotate(0deg); opacity: 0; }
  30% { opacity: 1; }
  to { transform: scale(11) rotate(220deg); opacity: 0.9; }
}
@keyframes transit-out {
  0%, 72% { opacity: 1; }
  100% { opacity: 0; visibility: hidden; }
}
@media (prefers-reduced-motion: reduce) {
  .transit-overlay { display: none !important; }
}
`;
