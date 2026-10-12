"use client";

import { useEffect } from "react";

/**
 * Theme — Pookie is a single spacecraft-cockpit experience (Mehedi
 * 2026-10-12, final locked direction). There is exactly one theme:
 * Space Black instrument panels. No theme switcher anywhere.
 *
 * This hook exists for API compatibility with existing imports and for the
 * one-time cleanup of legacy stored theme values ("bright-bridge",
 * "light", "dark") from localStorage plus the data-theme attribute.
 */
export type Theme = "space-black";

const KEY = "pookie-theme";
export const DEFAULT_THEME: Theme = "space-black";

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  // One-time migration: strip legacy theme storage so nothing ever renders
  // the dead Bright Bridge look again.
  useEffect(() => {
    try {
      localStorage.removeItem(KEY);
      document.documentElement.removeAttribute("data-theme");
    } catch {
      /* default stands */
    }
  }, []);

  return { theme: DEFAULT_THEME, setTheme: () => {} };
}
