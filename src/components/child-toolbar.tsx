"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactiveOrb } from "@/components/pookie/orb-reactive";
import { getPookieColor, subscribePookieColor } from "@/components/pookie/pookie-color";
import { MorePopup } from "@/components/more-popup";
import { GROVES, resolveModuleHref } from "@/lib/modules";

/**
 * The one orb — Pookie herself, hovering in the center of the console.
 * Squad Singularity (2026-10-12): Mehedi — "there should be just one orb
 * and that's in the center toolbar, hovering, subtle glowing, hypnotizing,
 * addictive, eager to please and help." No socket, no plate, no darkness:
 * she floats on her own light.
 */
function ToolbarOrb() {
  const [color, setColor] = useState<string | null>(() => getPookieColor());

  useEffect(() => subscribePookieColor(setColor), []);

  return (
    <span
      className="orb-breathe relative rounded-full"
      style={color ? { filter: `drop-shadow(0 0 14px ${color})` } : undefined}
    >
      <ReactiveOrb size={56} />
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

/** Live mission clock — HH:MM, ticking every second, colon blinking. */
function MissionClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = now.getSeconds();
  return (
    <span className="console-clock" aria-label={`Ship time ${hh}:${mm}`}>
      {hh}
      <span className={ss % 2 === 0 ? "console-clock-colon" : "console-clock-colon dim"}>:</span>
      {mm}
    </span>
  );
}

/**
 * Ship vitals — the left telemetry cluster. Power breathes 96–100%,
 * shields hold steady, the uplink dot pulses. Feels alive, never noisy.
 */
function ShipVitals() {
  const [power, setPower] = useState(98);
  useEffect(() => {
    const t = setInterval(() => {
      setPower((p) => {
        const next = p + (Math.random() > 0.5 ? 1 : -1);
        return Math.min(100, Math.max(96, next));
      });
    }, 2800);
    return () => clearInterval(t);
  }, []);
  const bars = Math.round(((power - 96) / 4) * 4); // 0–4 lit segments
  return (
    <span className="console-telemetry">
      <span className="console-vital-dot" aria-hidden="true" />
      <span>
        PWR <strong>{power}</strong>
      </span>
      <span className="console-powerbar" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} data-lit={i < bars} />
        ))}
      </span>
      <span className="console-telemetry-sep" aria-hidden="true">
        ·
      </span>
      <span>
        SHD <strong>100</strong>
      </span>
    </span>
  );
}

/**
 * Nav readout — the right telemetry cluster. Sector follows the active
 * tab, the mission clock ticks, signal bars breathe.
 */
function NavReadout({ sector }: { sector: string }) {
  return (
    <span className="console-telemetry">
      <span>{sector}</span>
      <span className="console-telemetry-sep" aria-hidden="true">
        ·
      </span>
      <MissionClock />
      <span className="console-signal" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <i key={i} style={{ animationDelay: `${i * 0.35}s` }} />
        ))}
      </span>
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
  sector: string;
  glyph?: () => ReactElement;
  orb?: boolean;
  popup?: boolean;
  active: boolean;
};

/**
 * Bottom toolbar — the ship's MAIN CONTROL CONSOLE.
 * Home · Today · Pookie (the one orb, hovering) · Progress · More.
 * Fixed on every /c/[childSlug]/ page; a slim standby variant covers
 * authenticated pages outside the tenant scope.
 *
 * Squad Singularity (2026-10-12): the orb descends from the cosmos and
 * settles into her hover on every navigation — divine arrival, not a
 * bounce. Keyed on pathname so the descent replays on each page change.
 */
export function ChildToolbar({ childSlug }: { childSlug: string }) {
  const pathname = usePathname();
  const base = `/c/${childSlug}`;
  const [moreOpen, setMoreOpen] = useState(false);

  // Prism E5 (2026-10-12): the More tab carries the active glow while a
  // module page is current — previously no tab lit up anywhere under
  // /health, /travel, /support, /marketplace, etc. Tabs with their own glow
  // (Home / Today / Pookie / Progress) keep precedence; absolute
  // (/household/*) pages live outside the console's tabs.
  const onModulePage = useMemo(() => {
    const hit = GROVES.flatMap((g) => g.modules).some((m) => {
      if (m.status !== "live" || !m.route) return false;
      const href = resolveModuleHref(childSlug, m.route);
      if (!href.startsWith(`${base}/`)) return false;
      return pathname === href || pathname.startsWith(`${href}/`);
    });
    if (!hit) return false;
    const claimedByTab =
      pathname === base ||
      pathname.startsWith(`${base}/today`) ||
      pathname.startsWith(`${base}/pookie`) ||
      pathname.startsWith(`${base}/school`);
    return !claimedByTab;
  }, [pathname, base, childSlug]);

  const tabs: TabDef[] = [
    { id: "home", label: "Home", href: base, glow: "#a78bfa", sector: "Sector · Home", glyph: HabitatRingGlyph, active: pathname === base },
    { id: "today", label: "Today", href: `${base}/today`, glow: "#6ee7b7", sector: "Sector · Today", glyph: OrbitGlyph, active: pathname.startsWith(`${base}/today`) },
    { id: "pookie", label: "Pookie", href: `${base}/pookie`, glow: "#ffd88a", sector: "AI Core", orb: true, active: pathname.startsWith(`${base}/pookie`) },
    { id: "progress", label: "Progress", href: `${base}/school`, glow: "#fbbf24", sector: "Sector · Progress", glyph: TrajectoryGlyph, active: pathname.startsWith(`${base}/school`) },
    // More opens the module popup (FR-MENU-001) — not a page. It also carries
    // the active glow while a module page is current (see onModulePage).
    { id: "more", label: "More", href: "", glow: "#c4b5fd", sector: "Module Bay", glyph: ModuleGridGlyph, popup: true, active: moreOpen || onModulePage },
  ];

  const activeTab = tabs.find((t) => t.active);
  const sector = pathname.includes("/settings")
    ? "Ship Systems"
    : (activeTab?.sector ?? "Deep Space");

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
        {/* Ship telemetry — live vitals left, nav + mission clock right */}
        <div className="console-status-strip" aria-hidden="true">
          <ShipVitals />
          <NavReadout sector={sector} />
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
                {/* The descent — she arrives from the cosmos on every page
                    change and settles into her hover. Keyed on pathname so
                    the arrival replays with each navigation. */}
                <span key={pathname} className="orb-descend relative block">
                  <ToolbarOrb />
                  <span className="console-orb-pool" aria-hidden="true" />
                </span>
                <span className="console-tab-label mt-1 text-[11px] font-medium text-stardust-200">
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
                <span className="console-tab-label text-[11px] font-medium text-stardust-200">
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
                <span className="console-tab-label text-[11px] font-medium text-stardust-200">
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
