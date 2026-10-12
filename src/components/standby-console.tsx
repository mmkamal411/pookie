"use client";

import { PookieOrb } from "@/components/pookie-orb";

/**
 * StandbyConsole — the ship's deck at rest.
 * Slim variant of the main console for authenticated pages outside the
 * tenant scope (/select-child, /me, /household/*): orb + status strip +
 * contextual label. No tabs — there's no vessel selected yet (or the page
 * is account-level), so controls would be dead switches.
 */
export function StandbyConsole({ label }: { label: string }) {
  return (
    <nav
      aria-label="Ship status"
      className="console-standby fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="console-status-strip" aria-hidden="true">
        <span>
          <span className="console-status-dot" />
          Systems nominal
        </span>
        <span>Standby</span>
      </div>
      <div className="mx-auto flex max-w-lg items-center justify-center gap-3 px-4 pt-0.5 pb-2.5">
        <span className="console-orb-socket block" aria-hidden="true">
          <PookieOrb size={36} />
        </span>
        <p className="text-[12px] font-medium tracking-wide text-stardust-300">{label}</p>
      </div>
    </nav>
  );
}

/** Spacer matching the standby console's footprint — keeps content clear. */
export function StandbyConsoleSpacer() {
  return <div className="h-24" aria-hidden="true" />;
}
