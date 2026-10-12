"use client";

/**
 * PookieOrb — Pookie and Mookie as a divine orb of light.
 *
 * Squad Nova (2026-10-12): Mehedi's words — "the pookie logo should be an
 * orb, like an angelic orb spiritual light with divine powers — that's
 * pookie and mookie!"
 *
 * The orb is the living heart of the app: a radiant celestial body with
 * a brilliant divine core, slowly rotating inner light (the angels'
 * wheel), and a breathing halo. screen blend on the dark cosmos.
 * Respects prefers-reduced-motion (static radiance, no animation).
 */
export function PookieOrb({ size = 64 }: { size?: number }) {
  const core = size * 0.6;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size, mixBlendMode: "screen" }}
      role="img"
      aria-label="Pookie, a divine orb of light"
    >
      {/* The halo — divine radiance extending far beyond the body */}
      <div
        aria-hidden="true"
        className="orb-halo absolute rounded-full"
        style={{ width: size * 2.2, height: size * 2.2 }}
      />
      {/* The aura — warm celestial glow hugging the orb */}
      <div
        aria-hidden="true"
        className="orb-aura absolute rounded-full"
        style={{ width: size * 1.4, height: size * 1.4 }}
      />
      {/* The celestial body — the orb itself, breathing */}
      <div
        aria-hidden="true"
        className="orb-body relative rounded-full"
        style={{ width: core, height: core }}
      >
        {/* Rotating inner light — the wheel within the wheel */}
        <div aria-hidden="true" className="orb-swirls absolute inset-0 rounded-full" />
        {/* The divine core — the brightest heart of light */}
        <div aria-hidden="true" className="orb-core absolute inset-0 rounded-full" />
      </div>
    </div>
  );
}
