// DevelopmentBadge — marks modules (or sections) that are still taking root.
// Spaceship aesthetic: a small, elegant pill with a subtle amber/orange neon
// glow. Looks intentional and premium — a module under construction, not an error.
//
// Two variants:
//   "pill" (default) — compact capitalize micro-label for cards/tiles/headers
//   "banner" — a slightly larger strip for the top of a module page
//
// (Squad Atlas 2026-10-12: Mehedi asked for visible "Development" tags on
// every module that isn't functional yet.)

"use client";

const PILL_CLASSES =
  "pill-glow inline-flex items-center gap-1.5 rounded-full border border-amber-400/45 " +
  "bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.14em] capitalize " +
  "text-amber-300 shadow-[0_0_12px_rgb(251_191_36/0.28)] whitespace-nowrap";

const BANNER_CLASSES =
  "inline-flex items-center gap-2 rounded-2xl border border-amber-400/40 " +
  "bg-amber-500/10 px-4 py-2 text-xs font-semibold tracking-[0.12em] capitalize " +
  "text-amber-200 shadow-[0_0_18px_rgb(251_191_36/0.22)]";

function SparkIcon({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className={className} style={{ filter: "drop-shadow(0 0 6px rgb(251 191 36 / 0.6))" }}>
      ✦
    </span>
  );
}

export function DevelopmentBadge({
  variant = "pill",
  label = "In development",
  className = "",
}: {
  variant?: "pill" | "banner";
  label?: string;
  className?: string;
}) {
  if (variant === "banner") {
    return (
      <div className={`${BANNER_CLASSES} ${className}`} role="status" aria-label={label}>
        <SparkIcon className="text-sm" />
        <span>{label}</span>
        <span className="font-normal normal-case tracking-normal text-amber-200/70">
          — this module is still taking root
        </span>
      </div>
    );
  }
  return (
    <span className={`${PILL_CLASSES} ${className}`} role="status" aria-label={label}>
      <SparkIcon className="text-[9px]" />
      {label}
    </span>
  );
}
