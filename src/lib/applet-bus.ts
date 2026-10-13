// Applet bus — the ship's temporary-applet dispatcher (2026-10-12).
//
// Mehedi's locked direction: every module opens as a TEMPORARY APPLET — a
// modal overlay floating in front of the pilot — with minimize + close, and
// NO full-page navigations for modules. (This also kills the theme-loss bug
// at the architectural root: modules never leave the SPA, so theme and video
// background can't reset.)
//
// Why a module-level bus: the More menu lives in the Command Deck at the
// ROOT layout, while the applet host must live inside the child layout
// (it needs the tenant context + the window-manager chrome CSS). React
// context can't cross that boundary, so the bus is a tiny external store
// (useSyncExternalStore) that both sides subscribe to.
//
// State model:
//   open:      the currently-visible applet { id, params } (one at a time)
//   minimized: stowed applets [{ id, params }] in minimize order — content
//              stays mounted in the host, so form state survives
//   justRestored: drives the restore animation, then clears

import { useSyncExternalStore } from "react";
import { GROVES, resolveModuleHref } from "@/lib/modules";

export type AppletParams = Record<string, string>;

export interface OpenApplet {
  id: string;
  params: AppletParams;
}

interface AppletBusState {
  open: OpenApplet | null;
  minimized: OpenApplet[];
  justRestored: string | null;
}

const EMPTY: AppletBusState = { open: null, minimized: [], justRestored: null };

let state: AppletBusState = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): AppletBusState {
  return state;
}

/** React subscription for the applet host. */
export function useAppletBus(): AppletBusState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export interface OpenOptions {
  /**
   * Replace the currently-open applet instead of stowing it. Used for
   * in-applet sub-navigation (FAQ → article, tickets → new/detail) so the
   * minimized dock doesn't accumulate stepping stones.
   */
  replace?: boolean;
}

/**
 * Open an applet. A currently-open applet is stowed (minimized) first —
 * the pilot never loses work by tapping a second module.
 */
export function openApplet(id: string, params: AppletParams = {}, opts: OpenOptions = {}): void {
  const next: OpenApplet = { id, params };
  const stowed = state.open && !opts.replace ? [...state.minimized, { ...state.open }] : state.minimized;
  // The opened applet can never also sit minimized — one instance, one state.
  const minimized = stowed.filter((m) => m.id !== id);
  state = { open: next, minimized, justRestored: null };
  emit();
}

/** Close the open applet (unmounts its content). */
export function closeApplet(): void {
  if (!state.open) return;
  state = { open: null, minimized: state.minimized, justRestored: null };
  emit();
}

/** Minimize the open applet — stowed as a chip, content stays mounted. */
export function minimizeApplet(): void {
  if (!state.open) return;
  const cur = state.open;
  state = {
    open: null,
    minimized: state.minimized.some((m) => m.id === cur.id)
      ? state.minimized
      : [...state.minimized, cur],
    justRestored: null,
  };
  emit();
}

/** Restore a minimized applet to the foreground. */
export function restoreApplet(id: string): void {
  const found = state.minimized.find((m) => m.id === id);
  if (!found) return;
  const minimized =
    state.open && state.open.id !== id
      ? [...state.minimized.filter((m) => m.id !== id && m.id !== state.open!.id), { ...state.open }]
      : state.minimized.filter((m) => m.id !== id);
  state = { open: { ...found }, minimized, justRestored: id };
  emit();
}

/** Clear the restore-animation flag after it plays. */
export function clearAppletRestored(): void {
  if (!state.justRestored) return;
  state = { ...state, justRestored: null };
  emit();
}

/**
 * Hard reset — closes the open applet and drops all minimized ones.
 * Used when the pilot switches children: applets are child-scoped and
 * must never leak one crew member's space into another's.
 */
export function resetApplets(): void {
  if (!state.open && state.minimized.length === 0 && !state.justRestored) return;
  state = EMPTY;
  emit();
}

// ---------------------------------------------------------------------------
// In-applet link interception — links inside an applet that point at another
// module route open that module as an applet instead of navigating the page.
// ---------------------------------------------------------------------------

export interface AppletLinkTarget {
  id: string;
  params: AppletParams;
  /** Module id to record in "Recent" (sub-views credit their parent). */
  recentId: string;
}

/**
 * Map an href (as written in module markup) to an applet target.
 * Returns null for external links, anchors, and routes that must keep
 * navigating (Home/Today/Progress views, settings).
 */
export function resolveAppletLink(href: string, childSlug: string): AppletLinkTarget | null {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(href, "https://applet.local");
  } catch {
    return null;
  }
  // External — never intercept.
  if (url.origin !== "https://applet.local") return null;
  const path = url.pathname;
  const base = `/c/${childSlug}`;

  // Support sub-views (most specific first).
  let m = path.match(new RegExp(`^${base}/support/faq/([^/]+)$`));
  if (m) {
    return { id: "faq-article", params: { slug: decodeURIComponent(m[1]) }, recentId: "S1" };
  }
  if (path === `${base}/support/tickets/new`) {
    return { id: "ticket-new", params: {}, recentId: "S3" };
  }
  m = path.match(new RegExp(`^${base}/support/tickets/([^/]+)$`));
  if (m) {
    return { id: "ticket-detail", params: { id: decodeURIComponent(m[1]) }, recentId: "S3" };
  }
  if (path === `${base}/support/chat`) {
    const params: AppletParams = {};
    const article = url.searchParams.get("article");
    if (article) params.article = article;
    return { id: "S2", params, recentId: "S2" };
  }

  // Canonical module routes from the registry (W1 School is the Progress
  // view — it keeps navigating to its page). Account-level modules (the
  // pilot's own stations, the Crew hub) resolve outside any child scope.
  for (const grove of GROVES) {
    for (const mod of grove.modules) {
      if (mod.status !== "live" || !mod.route || mod.id === "W1") continue;
      const href = mod.accountLevel ? mod.route : resolveModuleHref(childSlug, mod.route);
      if (path === href) {
        return { id: mod.id, params: {}, recentId: mod.id };
      }
    }
  }
  return null;
}
