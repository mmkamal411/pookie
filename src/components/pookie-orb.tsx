"use client";

/**
 * PookieOrb — Pookie as a ball of light, an angel.
 *
 * Aurora treatment (2026-10-12): the orb is the ship's ambient soul-light,
 * not a beacon. Moonlit, desaturated, mostly transparent at its edges —
 * sunlight through leaves, not a flashlight. It breathes slowly and bleeds
 * into whatever background sits behind it (screen blend on dark skies).
 */
export function PookieOrb({ size = 64 }: { size?: number }) {
  const core = size * 0.58;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size, mixBlendMode: "screen" }}
      role="img"
      aria-label="Pookie, a ball of light"
    >
      {/* Faint halo — barely-there radiance, no hard edge */}
      <div
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          width: size * 1.5,
          height: size * 1.5,
          background:
            "radial-gradient(circle, rgb(214 226 190 / 0.14) 0%, rgb(190 205 175 / 0.07) 45%, transparent 70%)",
        }}
      />
      {/* The ember itself — soft moonlit core dissolving into transparency */}
      <div
        aria-hidden="true"
        className="animate-breathe relative rounded-full"
        style={{
          width: core,
          height: core,
          opacity: 0.88,
          background:
            "radial-gradient(circle at 42% 36%, rgb(246 248 232 / 0.95) 0%, rgb(214 226 186 / 0.75) 30%, rgb(150 178 138 / 0.42) 58%, rgb(110 150 118 / 0.16) 78%, transparent 100%)",
          boxShadow:
            "0 0 16px rgb(200 218 180 / 0.22), 0 0 44px rgb(170 195 155 / 0.1)",
        }}
      />
    </div>
  );
}
