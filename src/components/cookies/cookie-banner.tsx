"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { openPreferenceCenter, useCookieConsent } from "@/lib/cookies/consent";

/**
 * Squad Cookie 2026-10-12 — Cookie consent banner.
 * Bottom banner on every page, first visit only (until the user decides).
 * Closing the banner without choosing accepts all cookies, per the spec.
 */
export function CookieBanner() {
  const { hasDecided, acceptAll, acceptRequired } = useCookieConsent();
  const [visible, setVisible] = useState(false);

  // Wait a beat after hydration so the banner glides in instead of flashing.
  useEffect(() => {
    if (hasDecided) {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => setVisible(true), 900);
    return () => window.clearTimeout(t);
  }, [hasDecided]);

  if (!visible) return null;

  const dismissAcceptAll = () => {
    acceptAll();
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie Consent"
      className="fixed inset-x-0 bottom-0 z-[80] px-3 pb-3 sm:px-6 sm:pb-5"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="neon-card neon-teal relative mx-auto max-w-4xl rounded-3xl border border-white/10 bg-[#0b1020]/95 p-5 shadow-2xl backdrop-blur-md sm:p-6">
        <p className="text-sm leading-relaxed text-white/80">
          Our websites require some cookies to function properly (required). In addition,
          other cookies may be used with your consent to analyze site usage, improve the
          user experience and for advertising. If you prefer that we only use the required
          cookies, please select &lsquo;Accept Only Required&rsquo;. Closing this banner
          without making other selections will accept all cookies.
        </p>
        <p className="mt-2 text-sm text-white/80">
          For more information, please review our{" "}
          <Link href="/cookies-policy" className="neon-hover text-neon-teal underline">
            Cookies Policy
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="neon-hover text-neon-teal underline">
            Privacy Statement
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={dismissAcceptAll}
            className="neon-cta neon-focus neon-green rounded-full border border-neon-green/40 bg-neon-green/15 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Accept All
          </button>
          <button
            type="button"
            onClick={() => {
              acceptRequired();
              setVisible(false);
            }}
            className="neon-cta neon-focus neon-blue rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Accept Only Required
          </button>
          <button
            type="button"
            onClick={openPreferenceCenter}
            className="neon-cta neon-focus neon-teal rounded-full border border-neon-teal/40 bg-neon-teal/15 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Manage Cookie Settings
          </button>
          <button
            type="button"
            onClick={dismissAcceptAll}
            aria-label="Close Cookie Banner"
            className="neon-focus neon-hover absolute right-3 top-3 rounded-full border border-white/10 p-1.5 text-white/60"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
