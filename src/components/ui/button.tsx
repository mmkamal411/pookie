// Button — Nebula buttons in the divine-light language.
// primary: dappled starlight sweep across nova pink (the hero action)
// ghost:   quiet outline for secondary moves
// danger:  soft red for destructive moves (still gentle, never harsh)
//
// Props:
//   variant  — "primary" | "ghost" | "danger"
//   size     — "sm" | "md" (default) | "lg"
//   href     — when set, renders a Next.js Link instead of a <button>
//   loading  — shows a soft pulse and disables the control
//   + all native button props (type, onClick, disabled, aria-*, …)

"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const VARIANTS: Record<string, string> = {
  primary:
    "btn-dapple text-white font-semibold border border-nova-300/40",
  ghost:
    "border border-nova-400/30 text-star-100 bg-nebula-900/50 hover:border-nova-400/60 hover:bg-nebula-900/80",
  danger:
    "border border-red-400/40 text-red-200 bg-red-950/40 hover:border-red-400/70 hover:bg-red-950/60",
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
  const cls = `inline-flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${loading ? "animate-pulse" : ""} ${className}`;
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
