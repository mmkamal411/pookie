// Card — the living Nebula card: frosted deep-space glass with a soft
// violet-pink glow edge (divine-light, never harsh). Shared surface for
// every squad's module tiles, list rows, and panel bodies.
//
// Props:
//   children   — card content
//   className  — extra classes (border/color tweaks)
//   glow       — "soft" (default) | "none" — disable the hover lift
//   padding    — "none" | "sm" | "md" (default) | "lg"
//   as         — "div" (default) | "section" | "article" | "li"

import type { ReactNode } from "react";

const PADDING: Record<string, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({
  children,
  className = "",
  glow = "soft",
  padding = "md",
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  glow?: "soft" | "none";
  padding?: keyof typeof PADDING;
  as?: "div" | "section" | "article" | "li";
}) {
  const Tag = as;
  const glowClass = glow === "soft" ? "card-living" : "";
  return (
    <Tag className={`${glowClass} rounded-2xl ${PADDING[padding]} ${className}`}>
      {children}
    </Tag>
  );
}
