"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

/**
 * ShipSettingsControl — the settings control as a ship-systems dial.
 * An SVG instrument (hex bezel + mixer sliders) with a soft neon stroke —
 * never the generic gear emoji. Links to the child's settings page.
 *
 * Prism E5 (2026-10-12): current-page indication — the toolbar has no
 * Settings tab, so this dial carries the active glow itself on /settings/*
 * routes (reuses the console-tab [data-active] neon treatment).
 */
export function ShipSettingsControl({ childSlug }: { childSlug: string }) {
  const pathname = usePathname();
  const active =
    pathname === `/c/${childSlug}/settings` ||
    pathname.startsWith(`/c/${childSlug}/settings/`);
  return (
    <Link
      href={`/c/${childSlug}/settings`}
      aria-label="Ship Systems — settings"
      aria-current={active ? "page" : undefined}
      data-active={active}
      className="console-tab-btn flex h-11 w-11 items-center justify-center rounded-full text-nova-300"
      style={{ "--tab-glow": "#f472b6", "--tab-glow-soft": "rgb(244 114 182 / 0.55)" } as CSSProperties}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
        style={{ filter: "drop-shadow(0 0 6px rgb(244 114 182 / 0.45))" }}
      >
        {/* hex bezel */}
        <path d="M12 2.8 L20 7.4 V16.6 L12 21.2 L4 16.6 V7.4 Z" opacity="0.65" />
        {/* mixer sliders */}
        <line x1="8" y1="9" x2="16" y2="9" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
        {/* knobs */}
        <circle cx="13.5" cy="9" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="10.5" cy="13" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="14.5" cy="17" r="1.7" fill="currentColor" stroke="none" />
      </svg>
    </Link>
  );
}
