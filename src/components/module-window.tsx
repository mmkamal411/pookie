"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  moduleForPathname,
  useWindowManager,
} from "@/components/window-manager";

/**
 * ModuleWindowFrame — the chrome around every tenant module window
 * (Squad Windows 2026-10-12).
 *
 * Renders the title bar (glow dot + readout prefix + prominent plain-English
 * name) above the page content, with working minimize (_) and close (X):
 * - Minimize: collapses the window with animation; a chip appears in the
 *   MinimizedDock above the Command Deck; the cosmic background shows
 *   through — the open-viewport moment.
 * - Close: animated out, then routes home (the open viewport). Home itself
 *   has no close button — it IS the viewport.
 *
 * Auto-restore: navigating to a minimized module's tab unminimizes it, so
 * the toolbar can never strand the user on a missing window.
 */

function MinimizeGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ModuleWindowFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { minimized, justRestored, minimize, restore, clearRestored } = useWindowManager();
  const [phase, setPhase] = useState<"idle" | "minimizing" | "closing">("idle");
  const timers = useRef<number[]>([]);

  const mod = moduleForPathname(pathname);
  const isMinimized = minimized.has(mod.id);
  const wasRestored = justRestored === mod.id;

  // Auto-restore when the user navigates (e.g. via toolbar tab) to a
  // minimized module — the tab can never lead to an empty window.
  useEffect(() => {
    if (isMinimized) restore(mod.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Clear the restore-animation flag after it plays.
  useEffect(() => {
    if (!wasRestored) return;
    const t = window.setTimeout(clearRestored, 450);
    return () => window.clearTimeout(t);
  }, [wasRestored, clearRestored]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const childSlug = pathname.match(/^\/c\/([^/]+)/)?.[1] ?? "";

  const handleMinimize = () => {
    if (phase !== "idle" || isMinimized) return;
    setPhase("minimizing");
    later(() => {
      minimize(mod.id);
      setPhase("idle");
    }, 290);
  };

  const handleClose = () => {
    if (phase !== "idle" || !mod.closable) return;
    setPhase("closing");
    later(() => {
      router.push(`/c/${childSlug}`);
      setPhase("idle");
    }, 290);
  };

  // Minimized: the window is stowed — render nothing here; the chip in the
  // MinimizedDock is the way back. The cosmic background shows through.
  if (isMinimized) return null;

  const phaseClass =
    phase === "minimizing"
      ? "modwin-minimizing"
      : phase === "closing"
        ? "modwin-closing"
        : wasRestored
          ? "modwin-restored"
          : "";

  return (
    <div
      className={`modwin ${phaseClass}`}
      style={{ "--modwin-glow": mod.glow } as React.CSSProperties}
    >
      <div className="modwin-titlebar" role="heading" aria-level={1}>
        <span className="modwin-dot" aria-hidden="true" />
        <span className="modwin-readout" aria-hidden="true">
          {mod.readout}
        </span>
        <span className="modwin-name">{mod.name}</span>
        <button
          type="button"
          className="modwin-btn"
          onClick={handleMinimize}
          aria-label={`Minimize ${mod.name} — stow the window and view space`}
          title="Minimize"
        >
          <MinimizeGlyph />
        </button>
        {mod.closable && (
          <button
            type="button"
            className="modwin-btn"
            onClick={handleClose}
            aria-label={`Close ${mod.name} — return to the open viewport`}
            title="Close"
          >
            <CloseGlyph />
          </button>
        )}
      </div>
      <div className="modwin-body">{children}</div>
    </div>
  );
}
