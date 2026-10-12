"use client";

import { usePathname } from "next/navigation";
import { ReactiveOrb } from "@/components/pookie/orb-reactive";

/**
 * StandbyConsole — the ship's deck at rest.
 * Slim variant of the main console for authenticated pages outside the
 * tenant scope (/select-child, /me, /household/*): the one orb hovering +
 * live telemetry. No tabs — there's no vessel selected yet (or the page
 * is account-level), so controls would be dead switches.
 *
 * Squad Singularity (2026-10-12): same divine arrival — she descends and
 * settles into her hover. No plate, no darkness, just light.
 */
export function StandbyConsole({ label }: { label: string }) {
  const pathname = usePathname();
  return (
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
  );
}

/** Spacer matching the standby console's footprint — keeps content clear. */
export function StandbyConsoleSpacer() {
  return <div className="h-24" aria-hidden="true" />;
}
