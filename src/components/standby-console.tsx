"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ReactiveOrb } from "@/components/pookie/orb-reactive";
import { MorePopup } from "@/components/more-popup";

/**
 * StandbyConsole — the ship's deck at rest.
 * Slim variant of the main console for authenticated pages outside the
 * tenant scope (/me, /household/*): the one orb hovering +
 * live telemetry. No tabs — the page is account-level (the pilot's own
 * systems, not a crew member's console), so controls would be dead switches.
 *
 * The Stations button opens the module directory in account mode (the
 * pilot's own stations + the Crew hub) — navigation for the opening page,
 * which is otherwise just the calm glass pane.
 *
 * Squad Singularity (2026-10-12): same divine arrival — she descends and
 * settles into her hover. No plate, no darkness, just light.
 */
export function StandbyConsole({ label }: { label: string }) {
  const pathname = usePathname();
  const [stationsOpen, setStationsOpen] = useState(false);
  return (
    <>
      <nav
        aria-label="Ship status"
        className="console-standby fixed inset-x-0 bottom-0 z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="console-status-strip" aria-hidden="true">
          <span className="console-telemetry">
            <span className="console-vital-dot" aria-hidden="true" />
            <span>
              PWR <strong>98</strong>
            </span>
          </span>
          <button
            type="button"
            onClick={() => setStationsOpen(true)}
            aria-haspopup="dialog"
            className="console-telemetry console-stations-btn"
            aria-label="Open stations — your modules and the Crew hub"
          >
            <span aria-hidden="true">▦</span>
            <span>
              <strong>Stations</strong>
            </span>
          </button>
          <span className="console-telemetry">
            <span>Standby</span>
            <span className="console-signal" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <i key={i} style={{ animationDelay: `${i * 0.35}s` }} />
              ))}
            </span>
          </span>
        </div>
        <div className="mx-auto flex max-w-lg items-center justify-center gap-3 px-4 pt-0.5 pb-2.5">
          <span key={pathname} id="standby-pookie-orb" className="orb-descend relative block" aria-hidden="true">
            <ReactiveOrb size={36} />
            <span className="console-orb-pool console-orb-pool-sm" aria-hidden="true" />
          </span>
          <p className="text-[12px] font-medium tracking-wide text-stardust-300">{label}</p>
        </div>
      </nav>
      <MorePopup
        open={stationsOpen}
        onClose={() => setStationsOpen(false)}
        childSlug=""
      />
    </>
  );
}

/** Spacer matching the standby console's footprint — keeps content clear. */
export function StandbyConsoleSpacer() {
  return <div className="h-24" aria-hidden="true" />;
}
