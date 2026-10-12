"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Bridge theme — "space-black" is the signature default (Mehedi 2026-10-12);
 * "bright-bridge" is the well-lit alternative. Persisted to localStorage
 * under "pookie-theme"; applied to <html> as data-theme="bright-bridge"
 * (space-black = no attribute, the default).
 */
export type Theme = "space-black" | "bright-bridge";

const KEY = "pookie-theme";
export const DEFAULT_THEME: Theme = "space-black";

/** Legacy values from the old dark/light toggle → new theme names. */
function migrate(saved: string | null): Theme {
  if (saved === "bright-bridge" || saved === "space-black") return saved;
  if (saved === "light") return "bright-bridge";
  return "space-black"; // "dark", null, or anything unknown
}

function readInitial(): Theme {
  // The pre-paint script in src/app/layout.tsx already applied the stored
  // theme to <html> — read it so first render matches, no flash.
  if (typeof document !== "undefined") {
    if (document.documentElement.getAttribute("data-theme") === "bright-bridge") {
      return "bright-bridge";
    }
  }
  return DEFAULT_THEME;
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(readInitial);

  // One-time migration: normalize legacy stored values to the new names.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      const next = migrate(saved);
      if (saved !== next) localStorage.setItem(KEY, next);
      setThemeState(next);
    } catch {
      /* default stands */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* best-effort */
    }
    if (t === "bright-bridge") {
      document.documentElement.setAttribute("data-theme", "bright-bridge");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, []);

  return { theme, setTheme };
}
