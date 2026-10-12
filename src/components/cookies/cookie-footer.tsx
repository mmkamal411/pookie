"use client";

import Link from "next/link";
import { openPreferenceCenter } from "@/lib/cookies/consent";

/**
 * Squad Cookie 2026-10-12 — Global footer.
 * Persistent home for the Cookies Policy, Privacy Statement, and the
 * Cookie Settings re-entry point (reopens the Preference Center).
 * Rendered once at the root layout, above the Command Deck.
 */
export function CookieFooter() {
  return (
    <footer className="relative z-10 border-t border-white/5 bg-transparent">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-4">
        <Link
          href="/cookies-policy"
          className="neon-hover neon-focus rounded text-xs text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
        >
          Cookies Policy
        </Link>
        <Link
          href="/privacy"
          className="neon-hover neon-focus rounded text-xs text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
        >
          Privacy Statement
        </Link>
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
