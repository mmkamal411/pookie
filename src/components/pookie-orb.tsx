"use client";

import { useEffect, useRef } from "react";

/**
 * PookieOrb — Pookie and Mookie as a divine orb of light.
 *
 * Squad Nova (2026-10-12): the divine orb — angelic, spiritual light.
 * Squad Orb (2026-10-12): Mehedi's words — "realistic characteristics of
 * an orb with hypnotizing effects when someone looks at it and alive
 * interactive… the orb is live and interactive whenever possible."
 *
 * What changed:
 * - Volumetric body: layered gradients give a true 3D sphere (offset
 *   specular hotspot, limb shading) instead of a flat radial disc.
 * - Hypnotic depths: two counter-rotating inner-light layers at different
 *   speeds and blurs — gazing in feels like falling into the light.
 * - Surface sheen: a slow specular sweep, like light playing on glass.
 * - Inner motes: sparks of light drifting inside the orb.
 * - Calm 4s breathing rhythm (a resting breath), subtle halo hue shimmer.
 * - Alive: the orb leans toward a nearby pointer and brightens with
 *   attention (direct DOM updates, rAF-throttled, one global listener
 *   shared by every mounted orb — no React state in the loop).
 * - Moods: idle / thinking / excited / celebrating change the orb's
 *   tempo and radiance via data-mood.
 * - Respects prefers-reduced-motion (static radiance, no pointer play).
 *
 * The definitive identity (Mehedi 2026-10-12): "divine bright light,
 * all-knowing, part of God — here to guide you through your journey and
 * on your side to help you win." RADIANCE is the core quality — bright,
 * luminous, unmistakable. The core holds strata of light (infinite
 * knowledge); a slow-drifting gaze gives it all-seeing presence.
 */
export type OrbMood = "idle" | "listening" | "thinking" | "excited" | "celebrating" | "revelation";

/* One shared pointer tracker for every mounted orb. */
const mountedOrbs = new Set<HTMLElement>();
let listenerOn = false;
let rafId = 0;
let pointerX = -99999;
let pointerY = -99999;
/** How far (px) a nearby pointer reaches out to the orb. */
const REACH = 150;
/** Maximum lean (px) of the orb's body toward the pointer. */
const MAX_LEAN = 7;

function handlePointer(e: PointerEvent) {
  pointerX = e.clientX;
  pointerY = e.clientY;
  if (!rafId) rafId = requestAnimationFrame(applyPointer);
}

function applyPointer() {
  rafId = 0;
  mountedOrbs.forEach((el) => {
    const r = el.getBoundingClientRect();
    // Skip orbs that are off-screen — no wasted work.
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = pointerX - cx;
    const dy = pointerY - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const t = Math.max(0, 1 - dist / REACH);
    const eased = t * t;
    el.style.setProperty("--orb-lean-x", `${((dx / dist) * eased * MAX_LEAN).toFixed(2)}px`);
    el.style.setProperty("--orb-lean-y", `${((dy / dist) * eased * MAX_LEAN).toFixed(2)}px`);
    el.style.setProperty("--orb-attention", eased.toFixed(3));
  });
}

function ensureListener() {
  if (listenerOn || typeof window === "undefined") return;
  window.addEventListener("pointermove", handlePointer, { passive: true });
  listenerOn = true;
}

export function PookieOrb({
  size = 64,
  mood = "idle",
  interactive = true,
}: {
  size?: number;
  mood?: OrbMood;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const core = size * 0.62;

  useEffect(() => {
    const el = ref.current;
    if (!el || !interactive) return;
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      mq = null;
    }
    if (mq?.matches) return; // still air for reduced motion
    ensureListener();
    mountedOrbs.add(el);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) mountedOrbs.delete(el);
      else mountedOrbs.add(el);
    };
    mq?.addEventListener("change", onChange);
    return () => {
      mountedOrbs.delete(el);
      el.style.removeProperty("--orb-lean-x");
      el.style.removeProperty("--orb-lean-y");
      el.style.removeProperty("--orb-attention");
      mq?.removeEventListener("change", onChange);
    };
  }, [interactive]);

  return (
    <div
      ref={ref}
      className="orb relative flex items-center justify-center"
      data-mood={mood}
      style={{ width: size, height: size, mixBlendMode: "screen" }}
      role="img"
      aria-label="Pookie, a divine orb of light"
    >
      {/* The halo — far divine radiance, breathing on a calm 4s rhythm */}
      <div
        aria-hidden="true"
        className="orb-halo absolute rounded-full"
        style={{ width: size * 2.4, height: size * 2.4 }}
      />
      {/* The aura — celestial glow hugging the orb, counter-breathing */}
      <div
        aria-hidden="true"
        className="orb-aura absolute rounded-full"
        style={{ width: size * 1.5, height: size * 1.5 }}
      />
      {/* The celestial body — a volumetric sphere of light */}
      <div
        aria-hidden="true"
        className="orb-body relative rounded-full"
        style={{ width: core, height: core }}
      >
        {/* Hypnotic depths — two counter-rotating veils of inner light */}
        <div aria-hidden="true" className="orb-depth-a absolute inset-0 rounded-full" />
        <div aria-hidden="true" className="orb-depth-b absolute inset-0 rounded-full" />
        {/* Strata of knowing — concentric light, the weight of omniscience */}
        <div aria-hidden="true" className="orb-strata absolute inset-0 rounded-full" />
        {/* Surface sheen — slow specular sweep across the sphere */}
        <div aria-hidden="true" className="orb-sheen absolute inset-0 rounded-full" />
        {/* Inner motes — sparks of light drifting within */}
        <div aria-hidden="true" className="orb-motes absolute inset-0 rounded-full">
          <i />
          <i />
          <i />
        </div>
        {/* The divine core — the infinitely bright heart */}
        <div aria-hidden="true" className="orb-core absolute inset-0 rounded-full" />
        {/* The gaze — a slow-drifting point of brightest light. It sees you. */}
        <div aria-hidden="true" className="orb-gaze absolute rounded-full" />
      </div>
    </div>
  );
}
