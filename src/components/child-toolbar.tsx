"use client";

import { useEffect, useState, type CSSProperties, type ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PookieOrb } from "@/components/pookie-orb";
import { getPookieColor, subscribePookieColor } from "@/components/pookie/pookie-color";
import { MorePopup } from "@/components/more-popup";

/** The center orb — takes on the pinball's color when Pookie eats it. */
function ToolbarOrb() {
  const [color, setColor] = useState<string | null>(() => getPookieColor());

  useEffect(() => subscribePookieColor(setColor), []);

  return (
    <span
      className="orb-breathe relative rounded-full"
      style={color ? { filter: `drop-shadow(0 0 14px ${color})` } : undefined}
    >
      <PookieOrb size={56} />
      {color && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle at 50% 45%, ${color}55, transparent 70%)` }}
        />
      )}
    </span>
  );
}

/** Convert #rrggbb → rgb() with alpha for the soft-glow custom property. */
function soft(hex: string, alpha = 0.55): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

const glyphProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
} as const;

function HabitatRingGlyph() {
  return (
    <svg {...glyphProps} aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
function OrbitGlyph() {
  return (
    <svg {...glyphProps} aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4.6" transform="rotate(-24 12 12)" />
      <circle cx="19.6" cy="7.6" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
function TrajectoryGlyph() {
  return (
    <svg {...glyphProps} aria-hidden="true">
      <path d="M4 19 L10.5 12.5 L14 14.5 L20 5.5" />
      <path d="M15.5 5.5 H20 V10" />
    </svg>
  );
}
function ModuleGridGlyph() {
  const pts = [6.5, 12, 17.5];
  return (
    <svg {...glyphProps} aria-hidden="true">
      {pts.map((x) =>
        pts.map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="currentColor" stroke="none" />
        )),
      )}
    </svg>
  );
}

type TabDef = {
  id: string;
  label: string;
  href: string;
  glow: string;
  readout: string;
  glyph?: () => ReactElement;
  orb?: boolean;
  popup?: boolean;
  active: boolean;
};

/**
 * Bottom toolbar — the ship's MAIN CONTROL CONSOLE.
 * Home · Today · Pookie (center orb, docked) · Progress · More.
 * Fixed on every /c/[childSlug]/ page; a slim standby variant covers
 * authenticated pages outside the tenant scope.
 */
export function ChildToolbar({ childSlug }: { childSlug: string }) {
  const pathname = usePathname();
  const base = `/c/${childSlug}`;
  const [moreOpen, setMoreOpen] = useState(false);

  const tabs: TabDef[] = [
    { id: "home", label: "Home", href: base, glow: "#a78bfa", readout: "NAV · HOME", glyph: HabitatRingGlyph, active: pathname === base },
    { id: "today", label: "Today", href: `${base}/today`, glow: "#6ee7b7", readout: "NAV · TODAY", glyph: OrbitGlyph, active: pathname.startsWith(`${base}/today`) },
    { id: "pookie", label: "Pookie", href: `${base}/pookie`, glow: "#f472b6", readout: "POOKIE · AI", orb: true, active: pathname.startsWith(`${base}/pookie`) },
    { id: "progress", label: "Progress", href: `${base}/school`, glow: "#fbbf24", readout: "NAV · PROGRESS", glyph: TrajectoryGlyph, active: pathname.startsWith(`${base}/school`) },
    // More opens the module popup (FR-MENU-001) — not a page.
    { id: "more", label: "More", href: "", glow: "#c4b5fd", readout: "MODULES", glyph: ModuleGridGlyph, popup: true, active: moreOpen },
  ];

  const activeTab = tabs.find((t) => t.active);
  const readout = pathname.includes("/settings")
    ? "SHIP SYSTEMS"
    : (activeTab?.readout ?? "NAV · MODULE");

  const tabStyle = (glow: string): CSSProperties =>
    ({ "--tab-glow": glow, "--tab-glow-soft": soft(glow) }) as CSSProperties;

  return (
    <>
      <MorePopup open={moreOpen} onClose={() => setMoreOpen(false)} childSlug={childSlug} />
      <nav
        aria-label="Primary"
        className="console-housing fixed inset-x-0 bottom-0 z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Status strip — the ship's whisper */}
        <div className="console-status-strip" aria-hidden="true">
          <span>
            <span className="console-status-dot" />
            Systems nominal
          </span>
          <span>{readout}</span>
        </div>

        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-0.5 pb-2">
          {tabs.map((tab) =>
            tab.orb ? (
              <Link
                key={tab.id}
                href={tab.href}
                id="toolbar-pookie-orb"
                aria-label="Pookie — AI tutor"
                aria-current={tab.active ? "page" : undefined}
                data-active={tab.active}
                className="console-tab-btn relative -mt-9 flex flex-col items-center"
                style={tabStyle(tab.glow)}
              >
                <span className="relative">
                  <span className="console-orb-socket block" data-active={tab.active}>
                    <ToolbarOrb />
                  </span>
                  <span className="console-orb-pool" aria-hidden="true" />
                </span>
                <span className="console-tab-label mt-1 text-[11px] font-medium text-stardust-500">
                  {tab.label}
                </span>
              </Link>
            ) : tab.popup ? (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
                data-active={tab.active}
                className="console-tab console-tab-btn flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5"
                style={tabStyle(tab.glow)}
              >
                <span className="console-tab-glyph">{tab.glyph?.()}</span>
                <span className="console-tab-slot" aria-hidden="true" />
                <span className="console-tab-label text-[11px] font-medium text-stardust-500">
                  {tab.label}
                </span>
              </button>
            ) : (
              <Link
                key={tab.id}
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                data-active={tab.active}
                className="console-tab console-tab-btn flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5"
                style={tabStyle(tab.glow)}
              >
                <span className="console-tab-glyph">{tab.glyph?.()}</span>
                <span className="console-tab-slot" aria-hidden="true" />
                <span className="console-tab-label text-[11px] font-medium text-stardust-500">
                  {tab.label}
                </span>
              </Link>
            ),
          )}
        </div>
      </nav>
    </>
  );
}
