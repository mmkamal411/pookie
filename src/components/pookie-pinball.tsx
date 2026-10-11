"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { setPookieColor } from "@/components/pookie/pookie-color";

/**
 * PookiePinball — the signature Pookie moment.
 * On each page load, a solid rubber bouncy ball (56px) drops from the top,
 * bounces with gravity, settles, then hops into the toolbar Pookie orb's
 * spot. Pookie "eats" it and takes on the ball's color via the shared
 * pookie-color state.
 *
 * Direct DOM updates for smooth 60fps (no React state in the loop).
 * Respects prefers-reduced-motion — skips entirely.
 * Ported from d-dash's teen/pookie-pinball.
 */

const BALL_COLORS = ["#22d3ee", "#4ade80", "#f87171", "#fbbf24", "#a78bfa", "#f472b6"];
const SIZE = 56;

export function PookiePinball() {
  const pathname = usePathname();
  const ballRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [ballColor] = useState(() => BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)]);
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /** The toolbar orb's viewport center — the ball lands precisely here. */
  const target = useCallback(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const el = document.getElementById("toolbar-pookie-orb");
    if (el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight - 52 };
  }, []);

  useEffect(() => {
    if (reduced) return;
    // Degrade gracefully: no animation loop without rAF + canvas 2D.
    try {
      const probe = document.createElement("canvas");
      if (!probe.getContext("2d") || typeof window.requestAnimationFrame !== "function") return;
    } catch {
      return;
    }
    const ball = ballRef.current;
    const wrap = wrapRef.current;
    if (!ball || !wrap) return;
    const ballEl: HTMLDivElement = ball;
    const wrapEl: HTMLDivElement = wrap;

    const w = window.innerWidth;
    const t = target();
    const R = SIZE / 2;
    const FLOOR = t.y; // the ball lands INSIDE toolbar Pookie's spot

    let px = t.x + (Math.random() - 0.5) * 160;
    let py = -SIZE;
    let vx = (t.x - px) * 0.8;
    let vy = 0;

    const GRAVITY = 2400;
    const REST = 0.62;

    let sqX = 1;
    let sqY = 1;
    let sqVX = 0;
    let sqVY = 0;

    const start = performance.now();
    let last = start;
    let raf = 0;
    let bounces = 0;
    let done = false;

    wrapEl.style.display = "block";
    ballEl.style.opacity = "1";
    ballEl.style.transition = "none";
    ballEl.style.transform = "";
    setActive(true);

    function frame(now: number) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      vy += GRAVITY * dt;
      px += vx * dt;
      py += vy * dt;
      vx += (t.x - px) * 2 * dt;

      if (px < R) {
        px = R;
        vx = Math.abs(vx) * REST;
      } else if (px > w - R) {
        px = w - R;
        vx = -Math.abs(vx) * REST;
      }

      if (py > FLOOR) {
        py = FLOOR;
        const impact = Math.abs(vy);
        vy = -Math.abs(vy) * REST;
        vx *= 0.7;
        bounces++;
        if (impact > 300) {
          sqY = 1 - Math.min(0.2, impact / 5000);
          sqVY = 5;
        }
        if (bounces >= 3 && Math.abs(vy) < 400) done = true;
      }

      sqVX += (-(sqX - 1) * 320 - sqVX * 16) * dt;
      sqVY += (-(sqY - 1) * 320 - sqVY * 16) * dt;
      sqX += sqVX * dt;
      sqY += sqVY * dt;

      if (done) {
        // Pookie eats the ball — take on its color via shared state.
        setPookieColor(ballColor);
        window.dispatchEvent(new CustomEvent("pookie:ate-ball", { detail: { color: ballColor } }));
        ballEl.style.transform = `translate(${t.x - R}px, ${t.y - R}px) scale(0.01)`;
        ballEl.style.opacity = "0";
        ballEl.style.transition = "transform 0.22s ease-in, opacity 0.22s ease-in";
        setTimeout(() => {
          wrapEl.style.display = "none";
          setActive(false);
        }, 240);
        return;
      }

      ballEl.style.transform = `translate(${px - R}px, ${py - R}px) scale(${sqX.toFixed(3)}, ${sqY.toFixed(3)})`;
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pathname, reduced, target, ballColor]);

  if (reduced) return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60]"
      style={{ display: active ? "block" : "none" }}
    >
      <div ref={ballRef} className="absolute top-0 left-0" style={{ willChange: "transform" }}>
        <div
          className="rounded-full"
          style={{
            width: SIZE,
            height: SIZE,
            position: "relative",
            backgroundColor: ballColor,
            backgroundImage:
              "radial-gradient(circle at 34% 30%, rgba(255,255,255,0.4), rgba(255,255,255,0) 50%), radial-gradient(circle at 70% 80%, rgba(0,0,0,0.18), rgba(0,0,0,0) 60%)",
            boxShadow: `0 0 32px 8px ${ballColor}55, 0 0 64px 16px ${ballColor}22`,
          }}
        />
      </div>
    </div>
  );
}
