// AppletHost — renders temporary module applets as modal overlays floating
// in front of the pilot (Mehedi 2026-10-12 locked direction).
//
// Chrome: the SAME window chrome as Home / Today / Progress (the modwin-*
// classes from window-manager.tsx) — title bar with glow dot + readout +
// plain-English name, working minimize (_) and close (X). No second pattern.
//
// Behavior:
// - open: overlay fades/scales in over a dimmed cockpit; body scroll locks
// - minimize: collapses to a chip in the applet dock (stacked above the
//   module-window dock); content STAYS MOUNTED so form state survives
// - close: unmounts, returns to the open viewport
// - Escape closes; backdrop clicks do NOT close (explicit X only —
//   a stray tap must never nuke the pilot's work)
// - links inside an applet that point at module routes open that module as
//   an applet (bus resolveAppletLink) — NO full-page navigations for modules
// - an error boundary per applet: a crashing module shows a plain-English
//   card with a way back, never a blank cockpit

"use client";

import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  clearAppletRestored,
  closeApplet,
  minimizeApplet,
  openApplet,
  resetApplets,
  resolveAppletLink,
  restoreApplet,
  useAppletBus,
  type AppletParams,
} from "@/lib/applet-bus";
import { recordModuleVisit } from "@/lib/menu-access";
import { useTenant } from "@/components/tenant-provider";
import { APPLETS, AppletContent } from "@/components/applet-content";

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

/** Per-applet crash containment — a dying module never kills the cockpit. */
class AppletErrorBoundary extends Component<
  { label: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    // Structured log for RCA (NO BLANK PAGES rule) — no user-facing jargon.
    console.error(`[applet] ${this.props.label} crashed`, err);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="p-1">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
            <p aria-hidden="true" className="text-3xl">
              🛰️
            </p>
            <p className="mt-3 text-base font-semibold text-star-100">Something Went Wrong</p>
            <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-stardust-300">
              {this.props.label} hit a rough patch and had to stop. Nothing was lost —
              close this window and try again.
            </p>
            <button
              type="button"
              onClick={() => closeApplet()}
              className="mt-4 rounded-xl border border-nova-400/40 bg-nova-500/15 px-5 py-2.5 text-sm font-medium text-star-100 transition-colors hover:bg-nova-500/25"
            >
              Close Window
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppletWindow({
  id,
  params,
  childSlug,
  restored,
}: {
  id: string;
  params: AppletParams;
  childSlug: string;
  restored: boolean;
}) {
  const def = APPLETS[id];
  const [phase, setPhase] = useState<"in" | "idle" | "minimizing" | "closing">("in");
  const timers = useRef<number[]>([]);
  const winRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setPhase("idle"), 300);
    timers.current.push(t);
    return () => {
      timers.current.forEach((x) => window.clearTimeout(x));
      timers.current = [];
    };
  }, [id]);

  // Clear the restore-animation flag after it plays.
  useEffect(() => {
    if (!restored) return;
    const t = window.setTimeout(clearAppletRestored, 500);
    return () => window.clearTimeout(t);
  }, [restored]);

  // Escape closes the applet; focus the window on open for keyboard users.
  useEffect(() => {
    winRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setPhase((p) => (p === "idle" || p === "in" ? "closing" : p));
        const t = window.setTimeout(closeApplet, 290);
        timers.current.push(t);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const handleMinimize = () => {
    if (phase !== "idle" && phase !== "in") return;
    setPhase("minimizing");
    later(minimizeApplet, 290);
  };

  const handleClose = () => {
    if (phase !== "idle" && phase !== "in") return;
    setPhase("closing");
    later(closeApplet, 290);
  };

  // In-applet link interception — module routes open as applets, never
  // as full-page navigations. External / new-tab links pass through.
  const onBodyClickCapture = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const el = e.target as HTMLElement;
      const anchor = el.closest("a[href]");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      const target = resolveAppletLink(anchor.getAttribute("href") ?? "", childSlug);
      if (!target) return;
      e.preventDefault();
      recordModuleVisit(target.recentId);
      openApplet(target.id, target.params, { replace: true });
    },
    [childSlug],
  );

  if (!def) return null;

  const phaseClass =
    phase === "in"
      ? "applet-entering"
      : phase === "minimizing"
        ? "modwin-minimizing"
        : phase === "closing"
          ? "modwin-closing"
          : restored
            ? "modwin-restored"
            : "";

  return (
    <div className="applet-backdrop" data-testid={`applet-${id}`}>
      <div
        ref={winRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={def.name}
        className={`applet-window modwin ${phaseClass}`}
        style={{ "--modwin-glow": def.glow } as React.CSSProperties}
      >
        <div className="modwin-titlebar" role="heading" aria-level={1}>
          <span className="modwin-dot" aria-hidden="true" />
          <span className="modwin-readout" aria-hidden="true">
            {def.readout}
          </span>
          <span className="modwin-name">{def.name}</span>
          <button
            type="button"
            className="modwin-btn"
            onClick={handleMinimize}
            aria-label={`Minimize ${def.name} — stow the window and view space`}
            title="Minimize"
          >
            <MinimizeGlyph />
          </button>
          <button
            type="button"
            className="modwin-btn"
            onClick={handleClose}
            aria-label={`Close ${def.name} — return to the open viewport`}
            title="Close"
          >
            <CloseGlyph />
          </button>
        </div>
        <div className="applet-scroll" onClickCapture={onBodyClickCapture}>
          <div className="modwin-body">
            <AppletErrorBoundary label={def.name}>
              <AppletContent id={id} params={params} />
            </AppletErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppletHost() {
  const { open, minimized, justRestored } = useAppletBus();
  const { activeChild } = useTenant();
  const childSlug = activeChild?.slug ?? "";
  const slugRef = useRef(childSlug);

  // Crew change: applets are child-scoped — never leak one child's space
  // into another's. Reset synchronously during render is forbidden, so the
  // reset runs in an effect keyed on the slug.
  useEffect(() => {
    if (slugRef.current !== childSlug) {
      slugRef.current = childSlug;
      resetApplets();
    }
  }, [childSlug]);

  // Body scroll lock while any applet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open && minimized.length === 0) return null;

  return (
    <>
      <style>{APPLET_CSS}</style>
      {/* Stowed applets stay mounted (hidden) so their state survives. */}
      {minimized.map((m) => {
        const def = APPLETS[m.id];
        if (!def) return null;
        return (
          <div key={m.id} hidden aria-hidden="true" style={{ display: "none" }}>
            <AppletErrorBoundary label={def.name}>
              <AppletContent id={m.id} params={m.params} />
            </AppletErrorBoundary>
          </div>
        );
      })}
      {open && (
        <AppletWindow
          key={open.id}
          id={open.id}
          params={open.params}
          childSlug={childSlug}
          restored={justRestored === open.id}
        />
      )}
      {/* Minimized-applet dock — same chip pattern as the module-window
          dock, stacked above it. */}
      {minimized.length > 0 && (
        <div className="applet-dock" role="toolbar" aria-label="Minimized applets — tap to restore">
          {minimized.map((m) => {
            const def = APPLETS[m.id];
            if (!def) return null;
            return (
              <button
                key={m.id}
                type="button"
                className="modwin-chip"
                style={{ "--modwin-glow": def.glow } as React.CSSProperties}
                onClick={() => restoreApplet(m.id)}
                aria-label={`Restore ${def.name}`}
              >
                <span className="modwin-dot" aria-hidden="true" />
                <span>{def.name}</span>
                <span className="modwin-chip-hint" aria-hidden="true">
                  tap to open
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/**
 * Self-contained applet CSS. The window chrome itself (modwin-*) comes
 * from window-manager.tsx — one pattern, reused verbatim. Only the modal
 * shell (backdrop, window frame, scroll area, dock offset) lives here.
 * No globals.css edits.
 */
const APPLET_CSS = `
.applet-backdrop {
  position: fixed; inset: 0; z-index: 90;
  display: flex; align-items: center; justify-content: center;
  padding: max(16px, env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));
  background: rgb(2 5 14 / 0.62);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  animation: applet-backdrop-in 200ms ease;
}
.applet-window {
  width: 100%; max-width: 880px;
  max-height: min(88dvh, 920px);
  display: flex; flex-direction: column; overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgb(255 255 255 / 0.12);
  background: linear-gradient(180deg, rgb(16 26 44 / 0.97), rgb(8 14 28 / 0.98));
  box-shadow: 0 24px 80px rgb(0 0 0 / 0.6), 0 0 44px var(--modwin-glow-soft, rgb(0 229 255 / 0.12));
  outline: none;
}
.applet-window .modwin-titlebar { border-radius: 0; margin: 0; flex-shrink: 0; }
.applet-entering { animation: applet-in 300ms cubic-bezier(0.2, 0.9, 0.3, 1.08); }
.applet-scroll {
  overflow-y: auto; overscroll-behavior: contain;
  padding: 16px 16px 20px;
  -webkit-overflow-scrolling: touch;
}
/* Minimized-applet dock — same chip visuals as the module-window dock,
   stacked above it so the two never collide. */
.applet-dock {
  position: fixed; left: 0; right: 0; z-index: 90;
  bottom: calc(178px + env(safe-area-inset-bottom));
  display: flex; justify-content: center; gap: 8px;
  padding: 0 16px; pointer-events: none;
  max-width: 100vw; overflow-x: auto; scrollbar-width: none;
}
.applet-dock::-webkit-scrollbar { display: none; }
.applet-dock .modwin-chip { pointer-events: auto; }
@keyframes applet-in {
  from { opacity: 0; transform: scale(0.94) translateY(18px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes applet-backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .applet-backdrop, .applet-entering { animation: none !important; }
}
`;
