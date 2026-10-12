// Menu visibility rules — who sees what in the More popup.
//
// Pure functions (FR-MENU-004/005, sol-ux §9). Client-side UX only: the API
// layer enforces real access server-side; the menu must never be the fence.
// Rules:
//   "hidden" — module is not rendered at all (age-gated: W24 <18, W30/W31
//              for teen accounts). A hidden module leaves no lock tile.
//   "locked" — module renders as a locked tile: the name is visible, nothing
//              about its contents (teenPrivate for parent viewers, FR-MENU-005).
//   "visible" — normal module row.
//
// Note on teenPrivate + age gating: teenPrivate is about WHO (parent vs the
// teen themselves); minAge/hideForTeen are about the viewer's age band.

import type { LifeModule } from "@/lib/modules";

/** Who is looking at the menu right now. */
export interface ViewerProfile {
  /** "parent" = a parent viewing the child's space; "child" = the teen/child themselves. */
  role: "parent" | "child";
  /**
   * Viewer's age in years. Null when unknown. A parent is always treated as an
   * adult; a child with unknown age is assumed 15 (typical teen) — permissive
   * enough not to lock their own modules, restrictive enough to hide 18+ ones.
   */
  age: number | null;
}

export type ModuleVisibility = "visible" | "locked" | "hidden";

/** True when the viewer counts as a teen for age-gating purposes. */
export function isTeenViewer(viewer: ViewerProfile): boolean {
  if (viewer.role === "parent") return false;
  const age = viewer.age ?? 15; // child with unknown age → treat as teen
  return age >= 13 && age < 18;
}

/**
 * Resolve what a viewer may see of a module in the menu.
 * Never reveals teen-private contents to parents (FR-MENU-005):
 * the locked tile carries only the module name + "Teen-private space".
 */
export function resolveModuleVisibility(
  mod: LifeModule,
  viewer: ViewerProfile
): ModuleVisibility {
  const age = viewer.age ?? (viewer.role === "child" ? 15 : null);

  // Teen accounts never see these at all (FR-MENU-004, sol-ux §9).
  if (mod.hideForTeen && isTeenViewer(viewer)) return "hidden";

  // Below the module's minimum age → hidden, never a lock tile.
  if (mod.minAge != null && age != null && age < mod.minAge) return "hidden";

  // Teen-private modules lock for parent viewers — never their contents.
  if (mod.teenPrivate && viewer.role === "parent") return "locked";

  return "visible";
}

// ---------------------------------------------------------------------------
// Recent modules (localStorage, client only)
// ---------------------------------------------------------------------------

const RECENT_KEY = "pookie.recentModules";
const RECENT_MAX = 6;

/** Module ids the viewer opened most recently, newest first. */
export function getRecentModuleIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Record a module visit so the Recent row stays fresh. */
export function recordModuleVisit(moduleId: string): void {
  if (typeof window === "undefined") return;
  try {
    const ids = getRecentModuleIds().filter((id) => id !== moduleId);
    ids.unshift(moduleId);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, RECENT_MAX)));
  } catch {
    // Storage unavailable — recent row just stays empty.
  }
}
