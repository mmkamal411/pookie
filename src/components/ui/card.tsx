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
//   tappable   — marks the card as interactive: pointer cursor, a slightly
//                deeper hover lift + glow so the tap affordance is obvious
//   onClick    — when set, the card becomes keyboard-operable
//                (role="button", Enter/Space activation)

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

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
  tappable = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  glow?: "soft" | "none";
  padding?: keyof typeof PADDING;
  as?: "div" | "section" | "article" | "li";
  tappable?: boolean;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
}) {
  const Tag = as as "div";
  const interactive = tappable || onClick != null;
  const glowClass = glow === "soft" ? "card-living quantum-press" : "";
  const tappableClass = interactive
    ? "cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-300/70"
    : "";

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      // Synthesize a click so keyboard users get the same affordance.
      (e.currentTarget as HTMLElement).click();
    }
  };

  return (
    <Tag
      className={`${glowClass} ${tappableClass} rounded-2xl ${PADDING[padding]} ${className}`}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </Tag>
  );
}
