"use client";

import { useCallback, useEffect, useState } from "react";
import {
  acceptAllCookies,
  acceptOnlyRequired,
  getStoredConsent,
  saveConsent,
  usePreferenceCenterSignal,
  type CookieConsent,
} from "@/lib/cookies/consent";

/**
 * Squad Cookie 2026-10-12 — Privacy Preference Center.
 * OneTrust-style modal: per-category toggles, expandable plain-language
 * descriptions, and explicit save. Mounted once at the root layout next to
 * the banner; opens on the pookie:open-cookie-preferences event.
 */

interface CategoryDef {
  key: keyof Pick<CookieConsent, "analytics" | "functional" | "advertising"> | "necessary";
  title: string;
  alwaysActive: boolean;
  blurb: string;
  details: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    key: "necessary",
    title: "Strictly Necessary Cookies",
    alwaysActive: true,
    blurb: "Required for Pookie to work at all. You cannot switch these off.",
    details: [
      "Keep you signed in as you move between pages.",
      "Remember your cookie consent choice itself.",
      "Protect forms and sessions against forgery.",
      "Without these, the app cannot load your data or keep you logged in.",
    ],
  },
  {
    key: "analytics",
    title: "Analytics Cookies",
    alwaysActive: false,
    blurb: "Help us understand how Pookie is used so we can improve it.",
    details: [
      "Count visits and page views in aggregate — never tied to your name.",
      "Show which features are popular and which are ignored.",
      "Reveal error patterns so we can fix broken flows faster.",
      "If off, we simply will not collect usage statistics about your visits.",
    ],
  },
  {
    key: "functional",
    title: "Performance and Functional Cookies",
    alwaysActive: false,
    blurb: "Remember your preferences and make Pookie feel faster.",
    details: [
      "Remember display choices such as theme and collapsed sections.",
      "Cache parts of pages so they load quicker on repeat visits.",
      "Keep the orb and background effects tuned to your device.",
      "If off, Pookie still works — it just forgets your preferences between visits.",
    ],
  },
  {
    key: "advertising",
    title: "Advertising and Social Media Cookies",
    alwaysActive: false,
    blurb: "Used for any future ads or social sharing features. Off by default.",
    details: [
      "Would remember that you shared something or clicked a promotion.",
      "Could tailor in-app suggestions based on past activity.",
      "Pookie currently runs no advertising; this category is reserved.",
      "If off, no advertising or social tracking cookies are ever set.",
    ],
  },
];

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`neon-focus relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ${
        checked ? "bg-neon-teal/70" : "bg-white/15"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        aria-hidden
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function PreferenceCenter() {
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState({ analytics: false, functional: false, advertising: false });
  const [expanded, setExpanded] = useState<string | null>(null);

  const openCenter = useCallback(() => {
    const current = getStoredConsent();
    if (current) {
      setChoices({
        analytics: current.analytics,
        functional: current.functional,
        advertising: current.advertising,
      });
    }
    setExpanded(null);
    setOpen(true);
  }, []);

  usePreferenceCenterSignal(openCenter);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const close = () => setOpen(false);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Privacy Preference Center"
      onClick={close}
    >
      <div
        className="neon-card neon-teal flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b1020]/95 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Privacy Preference Center</h2>
            <p className="mt-1 text-sm text-white/60">
              Manage how Pookie uses cookies on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close Preference Center"
            className="neon-focus neon-hover rounded-full border border-white/10 p-2 text-white/70"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Intro */}
        <div className="border-b border-white/10 px-6 py-4">
          <p className="text-sm leading-relaxed text-white/75">
            Any website you visit may store or retrieve information on your device, mostly
            through cookies. That information might be about you, your preferences, or your
            device, and it is used for the purposes described under each category below.
            The data controller for information processed through our cookies is{" "}
            <strong className="text-white">Pookie</strong>. Some cookies come from third
            parties — such as analytics and authentication providers — to give us web
            analytics and keep sign-in working.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/75">
            Use the toggles to accept cookies per category. Because we respect your right
            to privacy, you can choose not to allow some types of cookies, and you can
            withdraw your consent at any time by reopening this Preference Center from the{" "}
            <strong className="text-white">Cookie Settings</strong> link in the footer.
            Please read our{" "}
            <a href="/cookies-policy" className="neon-hover text-neon-teal underline">
              Cookies Policy
            </a>{" "}
            for more information.
          </p>
        </div>

        {/* Categories */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ul className="divide-y divide-white/10">
            {CATEGORIES.map((cat) => {
              const isOpen = expanded === cat.key;
              const checked = cat.alwaysActive
                ? true
                : choices[cat.key as keyof typeof choices];
              return (
                <li key={cat.key} className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : cat.key)}
                      aria-expanded={isOpen}
                      className="neon-focus flex flex-1 items-center justify-between gap-3 text-left"
                    >
                      <span>
                        <span className="block text-base font-medium text-white">{cat.title}</span>
                        {cat.alwaysActive && (
                          <span className="mt-1 inline-block rounded-full border border-neon-green/40 bg-neon-green/10 px-2 py-0.5 text-xs font-medium text-neon-green">
                            Always Active
                          </span>
                        )}
                      </span>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 18 18"
                        fill="none"
                        aria-hidden
                        className={`shrink-0 text-white/50 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      >
                        <path d="M4 7l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {cat.alwaysActive ? (
                      <span className="text-sm font-medium text-neon-green">Always Active</span>
                    ) : (
                      <Toggle
                        checked={checked}
                        label={cat.title}
                        onChange={(v) =>
                          setChoices((c) => ({
                            ...c,
                            [cat.key as keyof typeof c]: v,
                          }))
                        }
                      />
                    )}
                  </div>
                  {isOpen && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm text-white/75">{cat.blurb}</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/60">
                        {cat.details.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-white/10 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              acceptAllCookies();
              close();
            }}
            className="neon-cta neon-focus neon-green rounded-full border border-neon-green/40 bg-neon-green/15 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Accept All
          </button>
          <button
            type="button"
            onClick={() => {
              acceptOnlyRequired();
              close();
            }}
            className="neon-cta neon-focus neon-blue rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Accept Only Required
          </button>
          <button
            type="button"
            onClick={() => {
              saveConsent(choices);
              close();
            }}
            className="neon-cta neon-focus neon-teal rounded-full border border-neon-teal/40 bg-neon-teal/15 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Save My Cookie Settings
          </button>
        </div>
      </div>
    </div>
  );
}
