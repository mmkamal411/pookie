"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const KEY = "pookie-theme";

/** Theme state — "dark" is the Canopy Night Forest default. Persists to localStorage. */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") setThemeState(saved);
    } catch {
      /* default stands */
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* best-effort */
    }
    if (t === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
  }, []);

  return { theme, setTheme };
}
