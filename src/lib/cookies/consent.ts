"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * Squad Cookie 2026-10-12 — Cookie consent state.
 *
 * Consent lives in localStorage under POOKIE_CONSENT_KEY so it survives
 * visits without a server round-trip. Only the Strictly Necessary category
 * is ever active before the user chooses; all other categories stay dark
 * until the user opts in. The preference center opens via a tiny custom
 * event (OPEN_PREFERENCE_CENTER) so any surface — footer, settings, banner —
 * can summon it without prop drilling.
 */

export type CookieCategory = "analytics" | "functional" | "advertising";

export interface CookieConsent {
  necessary: true; // always on, never toggleable
  analytics: boolean;
  functional: boolean;
  advertising: boolean;
  decidedAt: string; // ISO timestamp of the last choice
  version: number; // bump when categories change
}

export const POOKIE_CONSENT_KEY = "pookie-cookie-consent";
export const POOKIE_CONSENT_VERSION = 1;

export const DEFAULT_CONSENT: CookieConsent = {
  necessary: true,
  analytics: false,
  functional: false,
  advertising: false,
  decidedAt: "",
  version: POOKIE_CONSENT_VERSION,
};

export const ALL_CONSENT: CookieConsent = {
  ...DEFAULT_CONSENT,
  analytics: true,
  functional: true,
  advertising: true,
};

export const OPEN_PREFERENCE_CENTER = "pookie:open-cookie-preferences";

function readConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(POOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed.version !== POOKIE_CONSENT_VERSION) return null;
    return { ...DEFAULT_CONSENT, ...parsed, necessary: true };
  } catch {
    return null;
  }
}

function writeConsent(consent: Omit<CookieConsent, "necessary" | "version" | "decidedAt"> | CookieConsent) {
  const full: CookieConsent = {
    necessary: true,
    analytics: consent.analytics,
    functional: consent.functional,
    advertising: consent.advertising,
    decidedAt: new Date().toISOString(),
    version: POOKIE_CONSENT_VERSION,
  };
  try {
    window.localStorage.setItem(POOKIE_CONSENT_KEY, JSON.stringify(full));
  } catch {
    // Storage unavailable (private mode etc.) — consent just won't persist.
  }
  window.dispatchEvent(new CustomEvent("pookie:consent-changed", { detail: full }));
  return full;
}

export function saveConsent(choices: {
  analytics: boolean;
  functional: boolean;
  advertising: boolean;
}): CookieConsent {
  return writeConsent(choices);
}

export function acceptAllCookies(): CookieConsent {
  return writeConsent({ analytics: true, functional: true, advertising: true });
}

export function acceptOnlyRequired(): CookieConsent {
  return writeConsent({ analytics: false, functional: false, advertising: false });
}

/** Summon the Privacy Preference Center from anywhere. */
export function openPreferenceCenter() {
  window.dispatchEvent(new CustomEvent(OPEN_PREFERENCE_CENTER));
}

function subscribeConsent(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener("pookie:consent-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("pookie:consent-changed", handler);
    window.removeEventListener("storage", handler);
  };
}

function getConsentSnapshot(): CookieConsent | null {
  return readConsent();
}

/**
 * useCookieConsent — reactive consent state.
 * Returns null until the client has hydrated (SSR-safe).
 */
export function useCookieConsent(): {
  consent: CookieConsent | null;
  hasDecided: boolean;
  save: (choices: { analytics: boolean; functional: boolean; advertising: boolean }) => CookieConsent;
  acceptAll: () => CookieConsent;
  acceptRequired: () => CookieConsent;
} {
  const consent = useSyncExternalStore(subscribeConsent, getConsentSnapshot, () => null);
  const save = useCallback(
    (choices: { analytics: boolean; functional: boolean; advertising: boolean }) =>
      saveConsent(choices),
    []
  );
  const acceptAll = useCallback(() => acceptAllCookies(), []);
  const acceptRequired = useCallback(() => acceptOnlyRequired(), []);
  return { consent, hasDecided: consent !== null, save, acceptAll, acceptRequired };
}

/**
 * usePreferenceCenterSignal — listen for open requests from anywhere
 * (banner "Manage Cookie Settings", footer "Cookie Settings").
 */
export function usePreferenceCenterSignal(onOpen: () => void) {
  useEffect(() => {
    const handler = () => onOpen();
    window.addEventListener(OPEN_PREFERENCE_CENTER, handler);
    return () => window.removeEventListener(OPEN_PREFERENCE_CENTER, handler);
  }, [onOpen]);
}

/** Public read of the stored consent (null when undecided). */
export function getStoredConsent(): CookieConsent | null {
  return readConsent();
}

/** Non-hook check for non-essential loaders: is this category consented? */
export function isCategoryConsented(category: CookieCategory): boolean {
  const consent = readConsent();
  if (!consent) return false;
  return consent[category];
}

/** Small helper for non-React code to react to consent changes. */
export function onConsentChange(callback: (consent: CookieConsent) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<CookieConsent>).detail;
    if (detail) callback(detail);
  };
  window.addEventListener("pookie:consent-changed", handler);
  return () => window.removeEventListener("pookie:consent-changed", handler);
}
