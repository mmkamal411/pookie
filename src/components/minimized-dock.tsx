"use client";

import { usePathname, useRouter } from "next/navigation";
import { useWindowManager } from "@/components/window-manager";
import { resolveModuleHref } from "@/lib/modules";

/**
 * MinimizedDock — floating restore chips for stowed module windows
 * (Squad Windows 2026-10-12).
 *
 * Fixed above the Command Deck (z-30, below the deck's z-40), thumb-
 * reachable, horizontally scrollable. Each chip shows the module's glow
 * dot + name; tapping restores the window (navigates to its route with a
 * restore animation). The dock only renders when at least one module is
 * minimized — otherwise the viewport stays clean.
 */
export function MinimizedDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { minimized, restore, moduleById } = useWindowManager();

  if (minimized.size === 0) return null;

  const childSlug = pathname.match(/^\/c\/([^/]+)/)?.[1] ?? "";
  const chips = [...minimized].map(moduleById);

  const handleRestore = (id: string) => {
    const mod = moduleById(id);
    restore(id);
    // Prism E5 2026-10-12: P0 fix — absolute (/household/*) module routes
    // must not be tenant-prefixed (that 404'd the restore).
    router.push(resolveModuleHref(childSlug, mod.route === "/" ? "" : mod.route));
  };

  return (
    <div className="modwin-dock" role="toolbar" aria-label="Stowed modules — tap to restore">
      {chips.map((mod) => (
        <button
          key={mod.id}
          type="button"
          className="modwin-chip"
          style={{ "--modwin-glow": mod.glow } as React.CSSProperties}
          onClick={() => handleRestore(mod.id)}
          aria-label={`Restore ${mod.name}`}
        >
          <span className="modwin-dot" aria-hidden="true" />
          <span>{mod.name}</span>
          <span className="modwin-chip-hint" aria-hidden="true">
            tap to open
          </span>
        </button>
      ))}
    </div>
  );
}
