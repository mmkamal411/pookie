"use client";

import { useEffect } from "react";

/**
 * Squad Mobile 2026-10-12 — registers the Pookie service worker.
 *
 * - Production builds only (staging + prod). Skipped in `next dev` so
 *   local development never fights a stale cache.
 * - Registers on window load so it never competes with first paint.
 * - Failures are silent: the app works identically without a worker.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* offline shell is a bonus, never a blocker */
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
