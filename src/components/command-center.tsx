"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/use-theme";
import { ChildRosterPanel } from "@/components/child-switcher";
import { signOut } from "@/lib/tenant/actions";

/**
 * Command Center — the ONLY top chrome on child dashboard pages.
 * A 40px spacecraft button tucked in the top-right corner with a pulsing
 * neon ring + blinking beacon dot so it's instantly findable. Tapping it
 * unfolds the secret mission-critical menu: pilot readout, crew roster,
 * bridge theme switcher, and mission-parameter links.
 *
 * Shared rules (both themes): no top toolbar, Title Case, spacecraft
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

function ThemeSwatch({ which, active }: { which: "space-black" | "bright-bridge"; active: boolean }) {
  const dark = which === "space-black";
  return (
    <span
      aria-hidden="true"
      className="h-9 w-9 shrink-0 rounded-md border"
      style={{
        background: dark ? "#050510" : "#F4F8FA",
        borderColor: dark ? "rgb(0 229 255 / 0.55)" : "rgb(0 184 212 / 0.5)",
        boxShadow: active
          ? dark
            ? "0 0 12px rgb(0 229 255 / 0.5)"
            : "0 0 12px rgb(0 184 212 / 0.45)"
          : "none",
      }}
    >
      <span
        className="mx-auto mt-1.5 block h-1 w-5 rounded-full"
        style={{ background: dark ? "rgb(0 229 255 / 0.9)" : "rgb(0 184 212 / 0.85)" }}
      />
      <span
        className="mx-auto mt-1 block h-1 w-3 rounded-full"
        style={{ background: dark ? "rgb(0 255 136 / 0.7)" : "rgb(0 200 83 / 0.7)" }}
      />
    </span>
  );
}

function MenuRow({
  href,
  label,
  detail,
  dark,
  onNavigate,
}: {
  href: string;
  label: string;
  detail: string;
  dark: boolean;
  onNavigate: () => void;
}) {
  const hover = dark ? "rgb(0 229 255 / 0.07)" : "rgb(0 184 212 / 0.07)";
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors"
      style={{ color: dark ? "rgb(232 240 254)" : "rgb(14 27 36)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = hover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span
          className="block font-mono text-[10px] tracking-[0.14em] uppercase"
          style={{ fontFamily: MONO, color: dark ? "rgb(138 155 184)" : "rgb(74 96 112)" }}
        >
          {detail}
        </span>
      </span>
      <span aria-hidden="true" style={{ color: dark ? "rgb(0 229 255 / 0.7)" : "rgb(0 184 212)" }}>
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
  const { theme, setTheme } = useTheme();
  const dark = theme !== "bright-bridge";
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
  const line = dark ? "rgb(0 229 255 / 0.14)" : "rgb(0 184 212 / 0.22)";
  const label = dark ? "rgb(138 155 184)" : "rgb(74 96 112)";
  const hover = dark ? "rgb(0 229 255 / 0.07)" : "rgb(0 184 212 / 0.07)";

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
          background: dark ? "rgb(5 5 16 / 0.97)" : "rgb(255 255 255 / 0.97)",
          border: dark ? "1px solid rgb(0 229 255 / 0.28)" : "1px solid rgb(0 184 212 / 0.35)",
          borderRadius: 8,
          boxShadow: dark
            ? "0 0 28px rgb(0 229 255 / 0.14), 0 20px 55px rgb(0 0 0 / 0.55)"
            : "0 8px 30px rgb(14 27 36 / 0.14), 0 0 22px rgb(0 184 212 / 0.12)",
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
            borderTop: `2px solid ${dark ? "rgb(0 229 255 / 0.9)" : "rgb(0 184 212 / 0.9)"}`,
            borderLeft: `2px solid ${dark ? "rgb(0 229 255 / 0.9)" : "rgb(0 184 212 / 0.9)"}`,
            borderTopLeftRadius: 8,
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            bottom: -1, right: -1, width: 12, height: 12,
            borderBottom: `2px solid ${dark ? "rgb(0 229 255 / 0.9)" : "rgb(0 184 212 / 0.9)"}`,
            borderRight: `2px solid ${dark ? "rgb(0 229 255 / 0.9)" : "rgb(0 184 212 / 0.9)"}`,
            borderBottomRightRadius: 8,
          }}
        />

        {/* Classified header */}
        <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: `1px solid ${line}` }}>
          <p
            className="flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.24em] uppercase"
            style={{ fontFamily: MONO, color: dark ? "rgb(0 229 255 / 0.95)" : "rgb(0 184 212)" }}
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
            style={{ color: dark ? "rgb(232 240 254)" : "rgb(14 27 36)" }}
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
              borderColor: dark ? "rgb(0 229 255 / 0.4)" : "rgb(0 184 212 / 0.45)",
              background: dark ? "rgb(17 24 50 / 0.9)" : "rgb(234 242 246)",
              color: dark ? "rgb(232 240 254)" : "rgb(14 27 36)",
              boxShadow: dark
                ? "0 0 12px rgb(0 229 255 / 0.25)"
                : "0 0 10px rgb(0 184 212 / 0.2)",
            }}
          >
            {(parentName.trim().slice(0, 1) || "?").toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-sm font-semibold"
              style={{ color: dark ? "rgb(232 240 254)" : "rgb(14 27 36)" }}
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

        {/* Bridge theme switcher */}
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${line}` }}>
          <p
            className="font-mono text-[10px] font-semibold tracking-[0.22em] uppercase"
            style={{ fontFamily: MONO, color: dark ? "rgb(0 229 255 / 0.9)" : "rgb(0 184 212)" }}
          >
            Bridge Theme
          </p>
          <div className="mt-2 flex gap-2">
            {(
              [
                { id: "space-black", label: "Space Black" },
                { id: "bright-bridge", label: "Bright Bridge" },
              ] as const
            ).map((t) => {
              const selected = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  aria-pressed={selected}
                  className="flex flex-1 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition"
                  style={{
                    borderColor: selected
                      ? dark
                        ? "rgb(0 229 255 / 0.6)"
                        : "rgb(0 184 212 / 0.6)"
                      : line,
                    background: selected
                      ? dark
                        ? "rgb(0 229 255 / 0.08)"
                        : "rgb(0 184 212 / 0.08)"
                      : "transparent",
                    boxShadow: selected
                      ? dark
                        ? "0 0 14px rgb(0 229 255 / 0.18)"
                        : "0 0 14px rgb(0 184 212 / 0.18)"
                      : "none",
                  }}
                >
                  <ThemeSwatch which={t.id} active={selected} />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: dark ? "rgb(232 240 254)" : "rgb(14 27 36)" }}
                  >
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mission parameters */}
        <nav aria-label="Command Center options" className="py-1.5">
          <MenuRow href={base} label="User Profile" detail="Identity // Preferences" dark={dark} onNavigate={onClose} />
          {role === "parent" && (
            <>
              <MenuRow
                href={`${base}/family`}
                label="Child Management"
                detail="Roster // Access"
                dark={dark}
                onNavigate={onClose}
              />
              <MenuRow
                href={`${base}/sync`}
                label="Account Settings"
                detail="Sync // Systems"
                dark={dark}
                onNavigate={onClose}
              />
            </>
          )}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors disabled:opacity-60"
            style={{ color: dark ? "rgb(232 240 254)" : "rgb(14 27 36)" }}
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
  const { theme } = useTheme();
  const dark = theme !== "bright-bridge";
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
          background: dark ? "rgb(11 16 32 / 0.92)" : "rgb(255 255 255 / 0.94)",
          border: `1px solid ${dark ? "rgb(0 229 255 / 0.45)" : "rgb(0 184 212 / 0.5)"}`,
          color: dark ? "#00E5FF" : "#00B8D4",
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
