"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChildRosterPanel } from "@/components/child-switcher";
import { signOut } from "@/lib/tenant/actions";

/**
 * Command Center — the ONLY top chrome on child dashboard pages.
 * A 40px spacecraft button tucked in the top-right corner with a pulsing
 * neon ring + blinking beacon dot so it's instantly findable. Tapping it
 * unfolds the secret mission-critical menu: pilot readout, crew roster,
 * and mission-parameter links.
 *
 * Single cockpit theme (Mehedi 2026-10-12): Space Black instrument panels
 * everywhere. The Bridge Theme switcher was removed with Bright Bridge.
 *
 * Shared rules: no top toolbar, Title Case, spacecraft
 * metaphors only, zero purple/lavender/pink/warmth.
 *
 * Keyframes (cc-unfold, cc-beacon-blink, cc-ring-breathe) live in
 * src/app/globals.css — no inline <style> injection.
 */

const MONO = 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace';

/** Spacecraft saucer icon — the helm mark. Never an emoji, never a gear. */
function SaucerIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 5px rgb(0 229 255 / 0.6))" }}
    >
      {/* dome */}
      <path d="M8.5 10.5c.6-2.8 1.9-4.3 3.5-4.3s2.9 1.5 3.5 4.3" />
      {/* saucer body */}
      <ellipse cx="12" cy="13.8" rx="8" ry="2.8" />
      {/* console lights */}
      <circle cx="12" cy="13.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="7.2" cy="13.8" r="0.8" fill="currentColor" stroke="none" opacity="0.65" />
      <circle cx="16.8" cy="13.8" r="0.8" fill="currentColor" stroke="none" opacity="0.65" />
    </svg>
  );
}

function MenuRow({
  href,
  label,
  detail,
  onNavigate,
}: {
  href: string;
  label: string;
  detail: string;
  onNavigate: () => void;
}) {
  const hover = "rgb(0 229 255 / 0.07)";
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors"
      style={{ color: "rgb(232 240 254)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = hover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span
          className="block font-mono text-[10px] tracking-[0.14em] uppercase"
          style={{ fontFamily: MONO, color: "rgb(138 155 184)" }}
        >
          {detail}
        </span>
      </span>
      <span aria-hidden="true" style={{ color: "rgb(0 229 255 / 0.7)" }}>
        ▸
      </span>
    </Link>
  );
}

function CommandCenterMenu({
  parentName,
  role,
  childSlug,
  onClose,
}: {
  parentName: string;
  role: "parent" | "child";
  childSlug: string;
  onClose: () => void;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function handleSignOut() {
    if (signingOut) return;
    if (!confirm("Sign out of Pookie?")) return;
    setSigningOut(true);
    // Dead-man's switch: sign-out must never strand the user.
    const fallback = setTimeout(() => {
      window.location.href = "/login";
    }, 15000);
    try {
      await signOut();
    } finally {
      clearTimeout(fallback);
    }
  }

  const base = `/c/${childSlug}/settings`;
  const line = "rgb(0 229 255 / 0.14)";
  const label = "rgb(138 155 184)";
  const hover = "rgb(0 229 255 / 0.07)";

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Command Center menu"
      className="absolute top-12 right-0 w-80"
      style={{ maxWidth: "calc(100vw - 1.5rem)" }}
    >
      <div
        className="relative"
        style={{
          background: "rgb(5 8 10 / 0.97)",
          border: "1px solid rgb(0 229 255 / 0.28)",
          borderRadius: 8,
          boxShadow: "0 0 28px rgb(0 229 255 / 0.14), 0 20px 55px rgb(0 0 0 / 0.55)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          transformOrigin: "top right",
          animation: "cc-unfold 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        {/* Corner brackets — holographic bezel, top-left + bottom-right. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            top: -1, left: -1, width: 12, height: 12,
            borderTop: "2px solid rgb(0 229 255 / 0.9)",
            borderLeft: "2px solid rgb(0 229 255 / 0.9)",
            borderTopLeftRadius: 8,
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            bottom: -1, right: -1, width: 12, height: 12,
            borderBottom: "2px solid rgb(0 229 255 / 0.9)",
            borderRight: "2px solid rgb(0 229 255 / 0.9)",
            borderBottomRightRadius: 8,
          }}
        />

        {/* Classified header */}
        <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: `1px solid ${line}` }}>
          <p
            className="flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.24em] uppercase"
            style={{ fontFamily: MONO, color: "rgb(0 229 255 / 0.95)" }}
          >
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: "#00E5FF",
                boxShadow: "0 0 6px rgb(0 229 255 / 0.9)",
                animation: "cc-beacon-blink 2.4s ease-in-out infinite",
              }}
            />
            Command Access // Classified
          </p>
          <p
            className="mt-1.5 text-lg font-semibold tracking-tight"
            style={{ color: "rgb(232 240 254)" }}
          >
            Command Center
          </p>
        </div>

        {/* Pilot readout — the logged-in user, never the child. */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: `1px solid ${line}` }}
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold"
            style={{
              borderColor: "rgb(0 229 255 / 0.4)",
              background: "rgb(13 17 22 / 0.9)",
              color: "rgb(232 240 254)",
              boxShadow: "0 0 12px rgb(0 229 255 / 0.25)",
            }}
          >
            {(parentName.trim().slice(0, 1) || "?").toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-sm font-semibold"
              style={{ color: "rgb(232 240 254)" }}
            >
              {parentName}
            </span>
            <span
              className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase"
              style={{ fontFamily: MONO, color: label }}
            >
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "#00FF88", boxShadow: "0 0 6px rgb(0 255 136 / 0.9)" }}
              />
              Aboard
            </span>
          </span>
        </div>

        {/* Crew roster — which child to view. */}
        <div style={{ borderBottom: `1px solid ${line}` }}>
          <ChildRosterPanel role={role} onDone={onClose} />
        </div>

        {/* Mission parameters */}
        <nav aria-label="Command Center options" className="py-1.5">
          <MenuRow href={base} label="User Profile" detail="Identity // Preferences" onNavigate={onClose} />
          {role === "parent" && (
            <>
              <MenuRow
                href={`${base}/family`}
                label="Child Management"
                detail="Roster // Access"
                onNavigate={onClose}
              />
              <MenuRow
                href={`${base}/sync`}
                label="Account Settings"
                detail="Sync // Systems"
                onNavigate={onClose}
              />
            </>
          )}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors disabled:opacity-60"
            style={{ color: "rgb(232 240 254)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Sign Out</span>
              <span
                className="block font-mono text-[10px] tracking-[0.14em] uppercase"
                style={{ fontFamily: MONO, color: label }}
              >
                End Session
              </span>
            </span>
            <span aria-hidden="true" style={{ color: "#FFB300" }}>
              ⏻
            </span>
          </button>
        </nav>
      </div>
    </div>
  );
}

/**
 * CommandCenterButton — the floating 40px spacecraft trigger, top-right.
 * Pulsing neon ring + blinking beacon dot: easy to find, never dominant.
 */
export function CommandCenterButton({
  parentName,
  role = "parent",
  childSlug,
}: {
  parentName: string;
  role?: "parent" | "child";
  childSlug: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="fixed z-50"
      style={{ top: "max(0.75rem, env(safe-area-inset-top))", right: "0.75rem" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Command Center — open user menu"
        className="relative flex h-10 w-10 items-center justify-center rounded-full"
        style={{
          background: "rgb(10 13 16 / 0.92)",
          border: "1px solid rgb(0 229 255 / 0.45)",
          color: "#00E5FF",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          animation: "cc-ring-breathe 3s ease-in-out infinite",
        }}
      >
        <SaucerIcon />
        {/* Beacon — the "you have a console" indicator light. */}
        <span
          aria-hidden="true"
          className="absolute"
          style={{
            top: 1,
            right: 1,
            width: 7,
            height: 7,
            borderRadius: 9999,
            background: "#00E5FF",
            boxShadow: "0 0 7px rgb(0 229 255 / 0.95)",
            animation: "cc-beacon-blink 2.4s ease-in-out infinite",
          }}
        />
      </button>
      {open && (
        <CommandCenterMenu
          parentName={parentName}
          role={role}
          childSlug={childSlug}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
