"use client";

import { useEffect, useRef } from "react";
import { PookieOrb, type OrbMood } from "@/components/pookie-orb";

/**
 * SoulOrb — the orb with a soul. Squad Orb (2026-10-12).
 *
 * Mehedi's directive: "The orb moves around the screen like a living being"
 * and "each time the user logs in, the orb greets them DIFFERENTLY — not
 * just different words, but different BEHAVIOR."
 *
 * - Unpredictable entrances: rush, materialize, spiral, awaken — picked at
 *   random on every mount, never repeating the previous one (sessionStorage).
 * - Organic drift afterwards: a slow, graceful wander — pauses, changes
 *   direction, sometimes drifts closer as if examining you, sometimes pulls
 *   back. Like a jellyfish, like a wisp. Never fast, never mechanical.
 * - Movements carry weight and intention — celestial, not jittery.
 * - Respects prefers-reduced-motion: no theatrics, no drift, still air.
 *
 * Used on the login page. The tap handler (boarding clearance) is passed
 * through; the soul owns all motion.
 */
export type Entrance = "rush" | "materialize" | "spiral" | "awaken";

const ENTRANCES: Entrance[] = ["rush", "materialize", "spiral", "awaken"];
const ENTRANCE_MS: Record<Entrance, number> = {
  rush: 1400,
  materialize: 2200,
  spiral: 2600,
  awaken: 2000,
};

function pickEntrance(): Entrance {
  let last: string | null = null;
  try {
    last = sessionStorage.getItem("pookie-last-entrance");
  } catch {
    /* private mode — pure randomness is fine */
  }
  const candidates = ENTRANCES.filter((e) => e !== last);
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  try {
    sessionStorage.setItem("pookie-last-entrance", pick);
  } catch {
    /* ignore */
  }
  return pick;
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function SoulOrb({
  size = 132,
  mood = "idle",
  bursting = false,
  onTap,
  tapLabel = "Request boarding clearance",
}: {
  size?: number;
  mood?: OrbMood;
  bursting?: boolean;
  onTap?: () => void;
  tapLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const entranceRef = useRef<Entrance | null>(null);
  if (entranceRef.current === null && typeof window !== "undefined") {
    entranceRef.current = reducedMotion() ? null : pickEntrance();
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || reducedMotion()) return;
    const entrance = entranceRef.current;

    let raf = 0;
    let driftTimer = 0;

    // After the entrance completes, begin the organic drift.
    if (entrance) {
      el.classList.add(`soul-enter-${entrance}`);
      driftTimer = window.setTimeout(() => {
        el.classList.remove(`soul-enter-${entrance}`);
        startDrift();
      }, ENTRANCE_MS[entrance]);
    } else {
      startDrift();
    }

    function startDrift() {
      let x = 0;
      let y = 0;
      let tx = 0;
      let ty = 0;
      let scale = 1;
      let tscale = 1;
      let nextRetarget = performance.now() + 2500;

      const boundX = () => Math.min(window.innerWidth * 0.16, 130);
      const boundY = () => Math.min(window.innerHeight * 0.1, 80);

      function retarget(now: number) {
        const r = Math.random();
        if (r < 0.22) {
          // Pause — hover in place, contemplating.
          tx = x;
          ty = y;
          tscale = 1;
        } else if (r < 0.36) {
          // Drift closer, as if examining you.
          tx = x * 0.4;
          ty = y * 0.4;
          tscale = 1.14;
        } else if (r < 0.44) {
          // Pull back, retreating into the cosmos.
          tx = (Math.random() * 2 - 1) * boundX();
          ty = (Math.random() * 2 - 1) * boundY();
          tscale = 0.94;
        } else {
          // Wander.
          tx = (Math.random() * 2 - 1) * boundX();
          ty = (Math.random() * 2 - 1) * boundY();
          tscale = 1;
        }
        nextRetarget = now + 4500 + Math.random() * 5500;
      }

      function tick(now: number) {
        if (now >= nextRetarget) retarget(now);
        // Slow, weighted easing — the orb arrives, never snaps.
        x += (tx - x) * 0.016;
        y += (ty - y) * 0.016;
        scale += (tscale - scale) * 0.024;
        el!.style.transform =
          `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(3)})`;
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(driftTimer);
    };
  }, []);

  const inner = (
    <div ref={wrapRef} className={`soul-orb relative${bursting ? " orb-burst" : ""}`}>
      <PookieOrb size={size} mood={mood} interactive />
    </div>
  );

  if (!onTap) return inner;

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={tapLabel}
      className="relative rounded-full outline-none"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {inner}
    </button>
  );
}
