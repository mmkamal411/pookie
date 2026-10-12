"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * WindowManager — the ship's window system (Squad Windows 2026-10-12).
 *
 * Every tenant module renders as a distinct ship window with its own chrome:
 * a title bar (readout prefix + plain-English name), a working minimize
 * (collapses to a floating chip docked above the Command Deck, leaving the
 * cosmic background fully visible), and a working close/X (returns to the
 * open home viewport).
 *
 * Minimize state is per-module and lives at the child-layout level, so it
 * survives route changes. Navigating to a minimized module's tab (or tapping
 * its chip) restores it — the user can never be stranded.
 *
 * All CSS is self-contained in the <style> block below — no globals.css
 * edits (Squad Viewport owns that file).
 */

export interface ModuleInfo {
  /** Stable id, used as the minimize-set key. */
  id: string;
  /** Plain-English name — the visually dominant part of the title bar. */
  name: string;
  /** Ship readout prefix, e.g. "NAV". Small, letter-spaced. */
  readout: string;
  /** Neon glow color for the title dot + chip. */
  glow: string;
  /** Route path (without the /c/[slug] prefix), for chip restore. */
  route: string;
  /** Home is the viewport itself — it can minimize but never close. */
  closable: boolean;
}

/** Derive the active module from the tenant pathname. Longest-prefix match. */
export function moduleForPathname(pathname: string): ModuleInfo {
  // Strip the /c/[slug] prefix.
  const rest = pathname.replace(/^\/c\/[^/]+/, "") || "/";
  for (const mod of MODULES) {
    if (mod.route === "/") {
      if (rest === "/") return mod;
    } else if (rest === mod.route || rest.startsWith(mod.route + "/")) {
      return mod;
    }
  }
  return MODULES[0]; // home fallback — never strand on an unknown route
}

const MODULES: ModuleInfo[] = [
  { id: "home", name: "Home", readout: "Nav", glow: "#00E5FF", route: "/", closable: false },
  { id: "today", name: "Today", readout: "Scan", glow: "#6ee7b7", route: "/today", closable: true },
  { id: "pookie", name: "Pookie", readout: "Comms", glow: "#ffd88a", route: "/pookie", closable: true },
  { id: "progress", name: "Progress", readout: "Trajectory", glow: "#fbbf24", route: "/school", closable: true },
  { id: "settings", name: "Ship Systems", readout: "Sys", glow: "#7dd3fc", route: "/settings", closable: true },
  { id: "health", name: "Health", readout: "Bio", glow: "#6ee7b7", route: "/health", closable: true },
  { id: "marketplace", name: "Marketplace", readout: "Trade", glow: "#2dd4bf", route: "/marketplace", closable: true },
  { id: "travel", name: "Travel", readout: "Voyage", glow: "#67e8f9", route: "/travel", closable: true },
  { id: "coparenting", name: "Co-parenting", readout: "Crew", glow: "#4ade80", route: "/coparenting", closable: true },
  { id: "credit", name: "Credit", readout: "Ledger", glow: "#fcd34d", route: "/credit", closable: true },
  { id: "support", name: "Support", readout: "Beacon", glow: "#93c5fd", route: "/support", closable: true },
];

interface WindowManagerState {
  /** Ids of currently-minimized modules. */
  minimized: Set<string>;
  /** Id of the module that just restored (drives the restore animation). */
  justRestored: string | null;
  minimize: (id: string) => void;
  restore: (id: string) => void;
  clearRestored: () => void;
  moduleById: (id: string) => ModuleInfo;
}

const WindowManagerContext = createContext<WindowManagerState | null>(null);

export function useWindowManager(): WindowManagerState {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) throw new Error("useWindowManager must be used inside WindowManagerProvider");
  return ctx;
}

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [minimized, setMinimized] = useState<Set<string>>(new Set());
  const [justRestored, setJustRestored] = useState<string | null>(null);

  const minimize = useCallback((id: string) => {
    setMinimized((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const restore = useCallback((id: string) => {
    setMinimized((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setJustRestored(id);
  }, []);

  const clearRestored = useCallback(() => setJustRestored(null), []);

  const moduleById = useCallback(
    (id: string) => MODULES.find((m) => m.id === id) ?? MODULES[0],
    []
  );

  const value = useMemo(
    () => ({ minimized, justRestored, minimize, restore, clearRestored, moduleById }),
    [minimized, justRestored, minimize, restore, clearRestored, moduleById]
  );

  return (
    <WindowManagerContext.Provider value={value}>
      <style>{WINDOW_CSS}</style>
      {children}
    </WindowManagerContext.Provider>
  );
}

/**
 * Self-contained window-system CSS. Brighter "well-lit cockpit" direction
 * (Mehedi 2026-10-12): luminous surfaces, readable text, vibrant-but-tasteful
 * neon. GPU-cheap (transform/opacity only). Honors prefers-reduced-motion.
 */
const WINDOW_CSS = `
.modwin { position: relative; }
.modwin-titlebar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 8px 10px 12px;
  margin: 0 0 4px 0;
  border-bottom: 1px solid rgb(255 255 255 / 0.09);
  background: linear-gradient(180deg, rgb(255 255 255 / 0.06), rgb(255 255 255 / 0.015));
  border-radius: 14px 14px 0 0;
  user-select: none; -webkit-user-select: none;
}
.modwin-dot {
  width: 9px; height: 9px; border-radius: 9999px; flex-shrink: 0;
  background: var(--modwin-glow, #00E5FF);
  box-shadow: 0 0 10px var(--modwin-glow, #00E5FF), 0 0 22px var(--modwin-glow, #00E5FF);
  animation: modwin-pulse 3.2s ease-in-out infinite;
}
.modwin-readout {
  font-size: 10px; letter-spacing: 0.22em; font-weight: 600;
  color: rgb(255 255 255 / 0.45); flex-shrink: 0;
}
.modwin-name {
  font-size: 15px; font-weight: 650; letter-spacing: 0.01em;
  color: rgb(255 255 255 / 0.94); flex: 1; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.modwin-btn {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
  color: rgb(255 255 255 / 0.72);
  background: rgb(255 255 255 / 0.05);
  border: 1px solid rgb(255 255 255 / 0.09);
  transition: background 160ms ease, color 160ms ease, transform 120ms ease, box-shadow 160ms ease;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.modwin-btn:hover {
  background: rgb(255 255 255 / 0.11); color: #fff;
  box-shadow: 0 0 14px rgb(255 255 255 / 0.12);
}
.modwin-btn:active { transform: scale(0.92); }
.modwin-btn:focus-visible {
  outline: 2px solid var(--modwin-glow, #00E5FF); outline-offset: 2px;
}
.modwin-body { position: relative; }
.modwin-minimizing { animation: modwin-minimize 280ms cubic-bezier(0.4, 0, 0.6, 1) forwards; }
.modwin-closing { animation: modwin-close 280ms cubic-bezier(0.4, 0, 0.6, 1) forwards; }
.modwin-restored { animation: modwin-restore 380ms cubic-bezier(0.2, 0.9, 0.3, 1.15); }
@keyframes modwin-minimize {
  to { opacity: 0; transform: scale(0.92) translateY(26px); }
}
@keyframes modwin-close {
  to { opacity: 0; transform: scale(0.96) translateY(-14px); }
}
@keyframes modwin-restore {
  from { opacity: 0; transform: scale(0.92) translateY(26px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes modwin-pulse {
  0%, 100% { opacity: 1; } 50% { opacity: 0.55; }
}
/* Minimized chip dock — floats above the Command Deck, thumb-reachable,
   clear of toolbar buttons and the Pookie orb. */
.modwin-dock {
  position: fixed; left: 0; right: 0; z-index: 30;
  bottom: calc(118px + env(safe-area-inset-bottom));
  display: flex; justify-content: center; gap: 8px;
  padding: 0 16px; pointer-events: none;
  max-width: 100vw; overflow-x: auto; scrollbar-width: none;
}
.modwin-dock::-webkit-scrollbar { display: none; }
.modwin-chip {
  pointer-events: auto;
  display: flex; align-items: center; gap: 8px;
  min-height: 48px; padding: 8px 14px 8px 12px; border-radius: 9999px;
  font-size: 13px; font-weight: 600; color: rgb(255 255 255 / 0.92);
  white-space: nowrap; flex-shrink: 0;
  background: linear-gradient(180deg, rgb(40 38 80 / 0.92), rgb(16 15 38 / 0.94));
  border: 1px solid rgb(255 255 255 / 0.14);
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.5), 0 0 16px var(--modwin-glow-soft, rgb(0 229 255 / 0.25));
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  animation: modwin-chip-pop 320ms cubic-bezier(0.2, 0.9, 0.3, 1.25);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: transform 140ms ease;
}
.modwin-chip:active { transform: scale(0.94); }
.modwin-chip:focus-visible {
  outline: 2px solid var(--modwin-glow, #00E5FF); outline-offset: 2px;
}
.modwin-chip .modwin-dot { animation: none; }
.modwin-chip-hint { font-size: 10px; color: rgb(255 255 255 / 0.5); font-weight: 500; }
@keyframes modwin-chip-pop {
  from { opacity: 0; transform: scale(0.6) translateY(14px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .modwin-minimizing, .modwin-closing, .modwin-restored, .modwin-chip { animation: none !important; }
  .modwin-dot { animation: none !important; }
  .modwin-btn, .modwin-chip { transition: none !important; }
}
`;
