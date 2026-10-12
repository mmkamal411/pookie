"use client";

// Animated cog — the command center's signature motif. Spins slowly while
// `active`; rests (with a soft glow) when idle. Pure SVG, no assets.

export function Gear({
  active = false,
  size = 44,
  className = "",
  glow = "text-cyan-300",
}: {
  active?: boolean;
  size?: number;
  className?: string;
  glow?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center ${glow} ${className}`}
      style={{ width: size, height: size, filter: "drop-shadow(0 0 6px currentColor)" }}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className={active ? "animate-[spin_3.5s_linear_infinite]" : undefined}
      >
        <g fill="currentColor" opacity={active ? 0.95 : 0.55}>
          {Array.from({ length: 8 }).map((_, i) => (
            <rect
              key={i}
              x="28.5"
              y="2"
              width="7"
              height="13"
              rx="2"
              transform={`rotate(${i * 45} 32 32)`}
            />
          ))}
          <path
            fillRule="evenodd"
            d="M32 13a19 19 0 1 0 0 38 19 19 0 0 0 0-38Zm0 10.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z"
          />
        </g>
      </svg>
    </span>
  );
}

/** Small status light with neon halo. */
export function StatusLight({
  color,
  pulse = false,
  label,
}: {
  color: "emerald" | "amber" | "rose" | "slate" | "cyan";
  pulse?: boolean;
  label?: string;
}) {
  const c = {
    emerald: "bg-emerald-300 text-emerald-300",
    amber: "bg-amber-300 text-amber-300",
    rose: "bg-rose-400 text-rose-400",
    slate: "bg-slate-500 text-slate-500",
    cyan: "bg-cyan-300 text-cyan-300",
  }[color];
  return (
    <span className="inline-flex items-center gap-2" role={label ? "img" : undefined} aria-label={label}>
      <span
        className={`h-2.5 w-2.5 rounded-full ${c} ${pulse ? "animate-pulse" : ""}`}
        style={{ boxShadow: "0 0 10px currentColor" }}
      />
      {label && <span className="text-xs font-medium text-white/70">{label}</span>}
    </span>
  );
}
