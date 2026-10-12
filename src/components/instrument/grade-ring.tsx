import { useId } from "react";
import { gradeBand } from "@/lib/grades";
import type { GradeBand } from "@/lib/grades";

/**
 * GradeRing — a class's grade as a glowing instrument dial.
 * SVG arc with a soft neon halo, luminous digits at the center.
 * Warm instrument, not a cold gauge: the glow breathes with the page.
 */
export function GradeRing({
  numeric,
  tone = "dark",
  size = 64,
}: {
  numeric: number | null;
  tone?: "dark" | "white";
  size?: number;
}) {
  const band: GradeBand = gradeBand(numeric);
  const pct = numeric == null ? 0 : Math.max(0, Math.min(100, numeric));

  const stroke = Math.max(4, size * 0.08);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = (pct / 100) * c;

  // Band hues — soft neon, matching bandStyleFor palettes.
  const hues: Record<GradeBand, { main: string; soft: string }> = {
    green: { main: "#4ade80", soft: "rgb(74 222 128 / 0.35)" },
    yellow: { main: "#fbbf24", soft: "rgb(251 191 36 / 0.35)" },
    orange: { main: "#fb923c", soft: "rgb(251 146 60 / 0.35)" },
    red: { main: "#f87171", soft: "rgb(248 113 113 / 0.35)" },
  };
  const h = numeric == null ? { main: "#a8b4c8", soft: "rgb(168 180 200 / 0.25)" } : hues[band];
  const track = tone === "white" ? "rgb(35 42 58 / 0.12)" : "rgb(0 229 255 / 0.14)";

  const ringId = `gr-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={numeric == null ? "Not graded yet" : `Grade ${numeric.toFixed(1)} percent`}
      className="shrink-0"
    >
      <defs>
        <filter id={`${ringId}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={h.main} floodOpacity="0.55" />
        </filter>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      {numeric == null ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={h.main}
          strokeOpacity="0.5"
          strokeWidth={stroke}
          strokeDasharray="4 6"
          strokeLinecap="round"
        />
      ) : (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={h.main}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          filter={`url(#${ringId}-glow)`}
        />
      )}
      <text
        x="50%"
        y="50%"
        dy="0.36em"
        textAnchor="middle"
        fill={tone === "white" ? "#1e2a3a" : "#f4f2ff"}
        fontSize={size * 0.26}
        fontWeight={600}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {numeric == null ? "—" : Math.round(numeric)}
      </text>
    </svg>
  );
}
