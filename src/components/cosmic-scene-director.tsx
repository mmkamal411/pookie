"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * CosmicSceneDirector — Squad Vista (2026-10-12).
 * The window the ship flies through is never static. A rotation of luminous
 * cosmic scenes (violet nebula, teal drift, rose nursery, indigo expanse,
 * emerald aurora) crossfades on a slow timer AND on every navigation
 * (course-change). Luminous sunlit vistas — Mehedi's bar: bright modern
 * spaceship bridge, like daylight through a panoramic viewport. Squad
 * Horizon (2026-10-12): scenes brightened dramatically toward the
 * white-bridge reference — luminous, optimistic, easy on the eyes.
 *
 * Two stacked fixed layers (z-index 1: above the starfield canvas at z-0,
 * below content at z-10+). Crossfade is opacity-only — GPU-cheap.
 * prefers-reduced-motion → single static scene, no timer.
 */
type Scene = { name: string; sky: string; wash: string };

const SCENES: Scene[] = [
  {
    name: "violet-nebula",
    sky: "linear-gradient(180deg, hsl(252 62% 34%) 0%, hsl(246 66% 42%) 55%, hsl(254 62% 32%) 100%)",
    wash:
      "radial-gradient(ellipse 60% 48% at 14% 6%, rgb(167 139 250 / 0.55) 0%, transparent 70%)," +
      "radial-gradient(ellipse 55% 45% at 88% 92%, rgb(139 92 246 / 0.48) 0%, transparent 70%)," +
      "radial-gradient(ellipse 38% 30% at 82% 12%, rgb(232 121 249 / 0.38) 0%, transparent 70%)," +
      "radial-gradient(ellipse 42% 34% at 8% 88%, rgb(129 140 248 / 0.42) 0%, transparent 70%)," +
      "radial-gradient(ellipse 90% 60% at 50% 50%, rgb(196 181 253 / 0.22) 0%, transparent 70%)",
  },
  {
    name: "teal-drift",
    sky: "linear-gradient(180deg, hsl(200 68% 32%) 0%, hsl(190 72% 40%) 55%, hsl(205 68% 30%) 100%)",
    wash:
      "radial-gradient(ellipse 62% 50% at 85% 10%, rgb(103 232 249 / 0.52) 0%, transparent 70%)," +
      "radial-gradient(ellipse 55% 45% at 10% 90%, rgb(94 234 212 / 0.46) 0%, transparent 70%)," +
      "radial-gradient(ellipse 40% 32% at 20% 15%, rgb(147 197 253 / 0.40) 0%, transparent 70%)," +
      "radial-gradient(ellipse 44% 36% at 90% 80%, rgb(103 232 249 / 0.38) 0%, transparent 70%)," +
      "radial-gradient(ellipse 90% 60% at 50% 50%, rgb(165 243 252 / 0.20) 0%, transparent 70%)",
  },
  {
    name: "rose-nursery",
    sky: "linear-gradient(180deg, hsl(320 62% 36%) 0%, hsl(330 66% 44%) 55%, hsl(315 62% 34%) 100%)",
    wash:
      "radial-gradient(ellipse 60% 48% at 12% 90%, rgb(249 168 212 / 0.52) 0%, transparent 70%)," +
      "radial-gradient(ellipse 55% 45% at 88% 8%, rgb(253 164 175 / 0.46) 0%, transparent 70%)," +
      "radial-gradient(ellipse 38% 30% at 75% 85%, rgb(253 224 71 / 0.30) 0%, transparent 70%)," +
      "radial-gradient(ellipse 42% 34% at 15% 12%, rgb(232 121 249 / 0.40) 0%, transparent 70%)," +
      "radial-gradient(ellipse 90% 60% at 50% 50%, rgb(251 207 232 / 0.20) 0%, transparent 70%)",
  },
  {
    name: "indigo-expanse",
    sky: "linear-gradient(180deg, hsl(232 66% 34%) 0%, hsl(228 70% 42%) 55%, hsl(236 66% 32%) 100%)",
    wash:
      "radial-gradient(ellipse 62% 50% at 50% 4%, rgb(129 140 248 / 0.55) 0%, transparent 70%)," +
      "radial-gradient(ellipse 55% 45% at 8% 70%, rgb(165 180 252 / 0.44) 0%, transparent 70%)," +
      "radial-gradient(ellipse 40% 32% at 92% 65%, rgb(196 181 253 / 0.36) 0%, transparent 70%)," +
      "radial-gradient(ellipse 44% 36% at 45% 100%, rgb(129 140 248 / 0.42) 0%, transparent 70%)," +
      "radial-gradient(ellipse 90% 60% at 50% 50%, rgb(199 210 254 / 0.22) 0%, transparent 70%)",
  },
  {
    name: "aurora-verdant",
    sky: "linear-gradient(180deg, hsl(165 62% 30%) 0%, hsl(175 66% 38%) 55%, hsl(160 62% 28%) 100%)",
    wash:
      "radial-gradient(ellipse 65% 40% at 50% 0%, rgb(110 231 183 / 0.50) 0%, transparent 70%)," +
      "radial-gradient(ellipse 55% 45% at 12% 85%, rgb(94 234 212 / 0.46) 0%, transparent 70%)," +
      "radial-gradient(ellipse 40% 32% at 88% 75%, rgb(253 224 71 / 0.28) 0%, transparent 70%)," +
      "radial-gradient(ellipse 42% 34% at 80% 15%, rgb(134 239 172 / 0.36) 0%, transparent 70%)," +
      "radial-gradient(ellipse 90% 60% at 50% 50%, rgb(167 243 208 / 0.20) 0%, transparent 70%)",
  },
];

const SCENE_COUNT = SCENES.length;
const ROTATE_MS = 75_000;
const CROSSFADE_MS = 2_800;

export function CosmicSceneDirector() {
  const pathname = usePathname();
  const [base, setBase] = useState(0);
  const [top, setTop] = useState({ scene: 1, visible: false });
  const nextRef = useRef(1);
  const transRef = useRef(0);
  const firstPathRef = useRef(true);
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const advance = useCallback(() => {
    const id = ++transRef.current;
    const n = nextRef.current;
    nextRef.current = (n + 1) % SCENE_COUNT;
    setTop({ scene: n, visible: true });
    if (typeof document !== "undefined") {
      document.body.dataset.cosmicScene = SCENES[n].name;
    }
    window.setTimeout(() => {
      // A newer advance supersedes this one — its timeout commits instead.
      if (transRef.current !== id) return;
      setBase(n);
      setTop((t) => ({ ...t, visible: false }));
    }, CROSSFADE_MS);
  }, []);

  // Course-change: a fresh scene on every navigation (skip initial mount).
  useEffect(() => {
    if (firstPathRef.current) {
      firstPathRef.current = false;
      return;
    }
    advance();
  }, [pathname, advance]);

  // Slow ambient rotation — the ship is always flying somewhere new.
  useEffect(() => {
    if (reduced) return;
    if (typeof document !== "undefined") {
      document.body.dataset.cosmicScene = SCENES[0].name;
    }
    const t = window.setInterval(advance, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [reduced, advance]);

  const baseBg = `${SCENES[base].wash}, ${SCENES[base].sky}`;
  const topBg = `${SCENES[top.scene].wash}, ${SCENES[top.scene].sky}`;

  return (
    <>
      <div aria-hidden="true" className="cosmic-scene-layer" style={{ background: baseBg }} />
      {!reduced && (
        <div
          aria-hidden="true"
          className={`cosmic-scene-layer cosmic-scene-top${top.visible ? " is-on" : ""}`}
          style={{ background: topBg }}
        />
      )}
    </>
  );
}
