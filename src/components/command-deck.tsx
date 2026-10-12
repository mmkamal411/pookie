"use client";

import { usePathname } from "next/navigation";
import { ChildToolbar } from "@/components/child-toolbar";
import { StandbyConsole } from "@/components/standby-console";

/**
 * CommandDeck — the ship's main control console, mounted ONCE in the root
 * layout so it NEVER unmounts on route changes and NEVER scrolls away.
 *
 * Mehedi 2026-10-12: "The toolbar should never disappear!"
 *
 * Root cause of the disappearance (Squad Viewport 2026-10-12):
 * `.console-housing { position: relative; }` in globals.css (unlayered)
 * overrode Tailwind v4's `fixed` utility (layered) — the toolbar was in
 * normal document flow and scrolled off-screen with the page. Fixed by
 * removing the position declaration; the deck is now truly fixed.
 *
 * Route behavior:
 * - /c/[childSlug]/* → full ChildToolbar (Home · Today · Pookie · Progress · More)
 * - Authenticated non-tenant pages → StandbyConsole with contextual label
 * - /login, /onboarding, /add-child, /verify-invite, /family/invite/accept,
 *   /account-deleted → hidden by design (clean entry, no dead controls)
 *
 * iOS Safari: uses position:fixed + bottom:0 with env(safe-area-inset-bottom)
 * padding. The deck sits above all page content (z-40) and page content
 * scrolls UNDER it (pages include bottom spacers).
 */

// Routes where the Command Deck stays hidden — clean entry points,
// no dead controls. Documented as intentional, not a bug.
const HIDDEN_ROUTES = [
  "/login",
  "/onboarding",
  "/add-child",
  "/verify-invite",
  "/family/invite/accept",
  "/account-deleted",
];

// Contextual standby labels for account-level pages.
const STANDBY_LABELS: [RegExp, string][] = [
  [/^\/select-child/, "Select your crew member"],
  [/^\/me/, "Your Pookie, watching over home"],
  [/^\/household/, "Household systems"],
  [/^\/family\/claims/, "Family claims"],
  [/^\/family\/invite/, "Family invites"],
];

function standbyLabelFor(pathname: string): string {
  for (const [re, label] of STANDBY_LABELS) {
    if (re.test(pathname)) return label;
  }
  return "Deep Space";
}

export function CommandDeck() {
  const pathname = usePathname();

  // Hidden by design on entry/auth pages.
  if (HIDDEN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return null;
  }

  // Tenant scope — full console with the child's slug from the URL.
  const childMatch = pathname.match(/^\/c\/([^/]+)/);
  if (childMatch) {
    return <ChildToolbar childSlug={childMatch[1]} />;
  }

  // Account-level pages — slim standby console.
  return <StandbyConsole label={standbyLabelFor(pathname)} />;
}

/**
 * CommandDeckSpacer — reserves vertical space so fixed-deck pages never
 * have content hidden underneath the console. Rendered by layouts alongside
 * the deck (the deck itself lives in the root layout).
 */
export function CommandDeckSpacer() {
  return <div className="h-32 shrink-0" aria-hidden="true" />;
}
