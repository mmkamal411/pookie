"use client";

import Link from "next/link";
import { openPreferenceCenter } from "@/lib/cookies/consent";

/**
 * Squad Cookie 2026-10-12 — Global footer (legal links home).
 * Squad Gavel 2026-10-12 — extended with the full legal surface:
 * Privacy Statement, Terms of Service, Children's Privacy, Do Not Sell or
 * Share, Cookies Policy, Accessibility, and the Cookie Settings re-entry
 * point (reopens the Preference Center).
 * Rendered once at the root layout, above the Command Deck.
 */
export function CookieFooter() {
  const links = [
    { href: "/privacy", label: "Privacy Statement" },
    { href: "/terms", label: "Terms of Service" },
    { href: "/privacy/children", label: "Children's Privacy" },
    { href: "/privacy/do-not-sell", label: "Do Not Sell or Share" },
    { href: "/cookies-policy", label: "Cookies Policy" },
    { href: "/accessibility", label: "Accessibility" },
  ];

  return (
    <footer className="relative z-10 border-t border-white/5 bg-transparent">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="neon-hover neon-focus rounded text-xs text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
          >
            {l.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={openPreferenceCenter}
          className="neon-hover neon-focus rounded text-xs text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
        >
          Cookie Settings
        </button>
      </div>
    </footer>
  );
}
