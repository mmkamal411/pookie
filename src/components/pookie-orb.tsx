"use client";

/**
 * PookieOrb — Pookie as a ball of light, an angel.
 * Divine soft radiance: a breathing golden-green orb wrapped in a halo
 * with slowly turning light rays. Sacred light, never cyberpunk.
 */
export function PookieOrb({ size = 64 }: { size?: number }) {
  return (
    <div
      className="halo relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Pookie, a ball of light"
    >
      <div className="light-rays rounded-full" />
      <div
        className="animate-breathe relative rounded-full"
        style={{
          width: size * 0.62,
          height: size * 0.62,
          background:
            "radial-gradient(circle at 38% 32%, #fffbeb 0%, #fde68a 28%, #4ade80 68%, #16a34a 100%)",
          boxShadow:
            "0 0 24px rgb(254 243 199 / 0.55), 0 0 64px rgb(74 222 128 / 0.35), 0 0 120px rgb(251 191 36 / 0.18)",
        }}
      />
    </div>
  );
}
