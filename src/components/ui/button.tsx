// Button — spacecraft command-deck buttons.
// primary:   dappled starlight sweep across cyan (the hero action)
// secondary: soft teal fill — the clear runner-up, never mistaken for primary
// ghost:     quiet outline for tertiary moves
// danger:    soft red for destructive moves (still gentle, never harsh)
//
// Hierarchy is unmistakable: primary glows and lifts, secondary glows
// softly, ghost stays flat until hovered. Every variant has a visible
// pressed state (active:scale) and a focus-visible neon ring.
//
// Props:
//   variant  — "primary" | "secondary" | "ghost" | "danger"
//   size     — "sm" | "md" (default) | "lg"
//   href     — when set, renders a Next.js Link instead of a <button>
//   loading  — shows a soft pulse and disables the control
//   + all native button props (type, onClick, disabled, aria-*, …)

"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const VARIANTS: Record<string, string> = {
  primary:
    "neon-cta neon-pink btn-dapple border border-nova-300/40 text-nebula-950 font-semibold hover:shadow-glow-md",
  secondary:
    "neon-hover neon-teal neon-active border border-teal-300/45 bg-teal-500/15 text-teal-100 shadow-glow-sm hover:bg-teal-500/25 hover:shadow-glow-md hover:border-teal-300/70",
  ghost:
    "neon-hover neon-teal neon-active border border-nova-400/30 text-star-100 bg-nebula-900/50 hover:border-nova-400/60 hover:bg-nebula-900/80 hover:shadow-glow-sm",
  danger:
    "neon-hover neon-active border border-red-400/40 text-red-200 bg-red-950/40 hover:border-red-400/70 hover:bg-red-950/60 hover:shadow-[0_0_14px_rgb(248_113_113/0.25)]",
};

const SIZES: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs rounded-xl",
  md: "px-5 py-2.5 text-sm rounded-2xl",
  lg: "px-6 py-3 text-base rounded-2xl",
};

type ButtonProps = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  href?: string;
  loading?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  size = "md",
  href,
  loading = false,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const cls = `inline-flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-nebula-950 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${loading ? "animate-pulse" : ""} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} aria-disabled={loading || disabled}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} disabled={disabled || loading} {...rest}>
      {children}
    </button>
  );
}
