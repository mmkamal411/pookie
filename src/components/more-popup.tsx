// MorePopup — the "More" tab as a bottom-sheet popup (FR-MENU-001..005).
// Reads the real module registry from src/lib/modules.ts — no mock lists.
//
// Inside the sheet:
//   • search field ("find a feature…") filtering module names + descriptions
//   • Recent row — last-visited modules, localStorage-backed, newest first
//   • 7 categories collapsed by default: sigil icon + name + module count;
//     tap to expand → module rows (name + watchOver line)
//   • age gating evaluates for real via resolveModuleVisibility (menu-access):
//     hidden modules are NOT rendered; locked (teenPrivate, parent viewer)
//     modules render as locked tiles — name visible, contents never
//   • an age-gated-empty category shows a growth-framed empty state, never
//     a dead tap (sol-ux §9)
//
// Props:
//   open, onClose      — sheet lifecycle
//   childSlug          — tenant route scope for live module links
//   viewerRole/viewerAge — optional override; defaults to useViewerProfile()
//     (role from tenant membership, age from the localStorage viewer record
//     until the backend ships an age endpoint)

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GROVES, resolveModuleHref, type Grove, type LifeModule } from "@/lib/modules";
import {
  resolveModuleVisibility,
  getRecentModuleIds,
  recordModuleVisit,
  type ModuleVisibility,
  type ViewerProfile,
} from "@/lib/menu-access";
import { useViewerProfile } from "@/lib/use-viewer-profile";
import { BottomSheet, Badge, EmptyCategoryCard } from "@/components/ui";
import { DevelopmentBadge } from "@/components/development-badge";

type ModuleHit = { mod: LifeModule; grove: Grove };

function buildModuleIndex(): Map<string, ModuleHit> {
  const index = new Map<string, ModuleHit>();
  for (const grove of GROVES) {
    for (const mod of grove.modules) index.set(mod.id, { mod, grove });
  }
  return index;
}

const MODULE_INDEX = buildModuleIndex();

/** One module row: live links navigate, seedlings expand to their seed action, locked tiles stay tiles. */
function ModuleRow({
  hit,
  visibility,
  childSlug,
  onNavigate,
}: {
  hit: ModuleHit;
  visibility: ModuleVisibility;
  childSlug: string;
  onNavigate: () => void;
}) {
  const { mod } = hit;
  const [seedOpen, setSeedOpen] = useState(false);

  if (visibility === "locked") {
    // teenPrivate for a parent viewer (FR-MENU-005): existence visible,
    // contents never. Not a button — there is no hunting path.
    return (
      <div className="card-living rounded-2xl p-4" aria-label={`${mod.name} — teen-private space`}>
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="text-base text-stardust-400">🔒</span>
          <p className="text-sm font-medium text-star-100">{mod.name}</p>
          <Badge tone="locked">Teen-private space</Badge>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-stardust-400">
          This space belongs to your teen — parents can&apos;t see inside.
        </p>
      </div>
    );
  }

  if (mod.status === "live" && mod.route) {
    const href = resolveModuleHref(childSlug, mod.route);
    return (
      <Link
        href={href}
        onClick={() => {
          recordModuleVisit(mod.id);
          onNavigate();
        }}
        className="card-living block rounded-2xl p-4"
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-star-100">{mod.name}</p>
          <Badge tone="live">Live</Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-stardust-300">{mod.watchOver}</p>
      </Link>
    );
  }

  // Seedling: a designed state — expands to the real one-step seed action.
  // Tagged with the Development badge so it's unmistakable (Mehedi 2026-10-12).
  return (
    <div className="card-living rounded-2xl p-4">
      <button
        type="button"
        onClick={() => setSeedOpen((o) => !o)}
        aria-expanded={seedOpen}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-star-100">
              <span aria-hidden="true" className="mr-1.5 text-xs">🌱</span>
              {mod.name}
            </p>
            <DevelopmentBadge />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-stardust-300">{mod.watchOver}</p>
        </div>
        <span aria-hidden="true" className={`shrink-0 text-xs text-nova-300 transition-transform ${seedOpen ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {seedOpen && (
        <div className="animate-rise mt-3 border-t border-nova-400/10 pt-3">
          <p className="text-xs text-stardust-300">Taking root — the first step is small and real:</p>
          <p className="mt-1 text-sm font-medium text-aurum-300">{mod.seedAction}</p>
          {mod.teenPrivate && <p className="mt-1 text-[11px] text-stardust-500">Teen-private space</p>}
        </div>
      )}
    </div>
  );
}

export function MorePopup({
  open,
  onClose,
  childSlug,
  viewerRole,
  viewerAge,
}: {
  open: boolean;
  onClose: () => void;
  childSlug: string;
  viewerRole?: ViewerProfile["role"];
  viewerAge?: number | null;
}) {
  const profile = useViewerProfile();
  const viewer: ViewerProfile = {
    role: viewerRole ?? profile.role,
    age: viewerAge !== undefined ? viewerAge : profile.age,
  };

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Per-category lists of modules the viewer may see (hidden ones dropped).
  const visibleByGrove = useMemo(() => {
    return GROVES.map((grove) => ({
      grove,
      hits: grove.modules
        .map((mod) => {
          const visibility = resolveModuleVisibility(mod, viewer);
          return { mod, grove, visibility };
        })
        .filter((h) => h.visibility !== "hidden"),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.role, viewer.age]);

  const searching = query.trim().length > 0;
  const searchHits = useMemo(() => {
    if (!searching) return [];
    const q = query.trim().toLowerCase();
    const hits: { hit: ModuleHit; visibility: ModuleVisibility }[] = [];
    for (const { grove, hits: gh } of visibleByGrove) {
      for (const h of gh) {
        if (
          h.mod.name.toLowerCase().includes(q) ||
          h.mod.watchOver.toLowerCase().includes(q)
        ) {
          hits.push({ hit: { mod: h.mod, grove }, visibility: h.visibility });
        }
      }
    }
    return hits;
  }, [searching, query, visibleByGrove]);

  const recentHits = useMemo(() => {
    if (searching) return [];
    const ids = getRecentModuleIds();
    const out: { hit: ModuleHit; visibility: ModuleVisibility }[] = [];
    for (const id of ids) {
      const found = MODULE_INDEX.get(id);
      if (!found) continue;
      const visibility = resolveModuleVisibility(found.mod, viewer);
      // Recent = things actually opened: live modules with a real route.
      if (visibility === "visible" && found.mod.status === "live" && found.mod.route) {
        out.push({ hit: found, visibility });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searching, viewer.role, viewer.age]);

  const toggleGrove = (name: string) =>
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));

  // Growth-framed suggestion when a category is gated empty (sol-ux §9).
  const suggestion = useMemo(() => {
    for (const { grove, hits } of visibleByGrove) {
      const first = hits.find((h) => h.visibility === "visible" && h.mod.status === "live");
      if (first) return { moduleName: first.mod.name, groveName: grove.name };
    }
    for (const { grove, hits } of visibleByGrove) {
      const first = hits.find((h) => h.visibility === "visible");
      if (first) return { moduleName: first.mod.name, groveName: grove.name };
    }
    return null;
  }, [visibleByGrove]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="More"
      subtitle="Everything Pookie watches over — tap a grove to open it."
    >
      <div className="pb-2">
        <label htmlFor="more-menu-search" className="sr-only">Find a feature</label>
        <input
          id="more-menu-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="find a feature…"
          autoComplete="off"
          className="w-full rounded-2xl border border-nova-400/25 bg-nebula-900/70 px-4 py-3 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-400/60 focus:outline-none"
          style={{ boxShadow: "inset 0 0 18px rgb(5 5 16 / 0.5)" }}
        />
      </div>

      {searching ? (
        <div className="mt-3 space-y-2.5">
          {searchHits.length === 0 ? (
            <p className="py-6 text-center text-sm text-stardust-400">
              Nothing matches “{query.trim()}” — try “school”, “money”, or “health”.
            </p>
          ) : (
            searchHits.map(({ hit, visibility }) => (
              <ModuleRow
                key={`${hit.grove.name}-${hit.mod.id}`}
                hit={hit}
                visibility={visibility}
                childSlug={childSlug}
                onNavigate={onClose}
              />
            ))
          )}
        </div>
      ) : (
        <>
          {recentHits.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-stardust-500 capitalize">Recent</p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {recentHits.map(({ hit }) => (
                  <Link
                    key={hit.mod.id}
                    href={resolveModuleHref(childSlug, hit.mod.route!)}
                    onClick={() => {
                      recordModuleVisit(hit.mod.id);
                      onClose();
                    }}
                    className="flex shrink-0 items-center gap-2 rounded-full border border-nova-400/25 bg-nebula-900/70 px-3.5 py-2 text-xs text-star-100 transition-colors hover:border-nova-400/50"
                  >
                    <span aria-hidden="true">{hit.grove.sigil}</span>
                    {hit.mod.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2.5">
            {visibleByGrove.map(({ grove, hits }) => {
              const isOpen = !!expanded[grove.name];
              return (
                <div key={grove.name} className="card-living overflow-hidden rounded-2xl">
                  <button
                    type="button"
                    onClick={() => toggleGrove(grove.name)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <span aria-hidden="true" className="text-xl" style={{ filter: "drop-shadow(0 0 8px rgb(244 114 182 / 0.35))" }}>
                      {grove.sigil}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-star-100">{grove.name}</span>
                      <span className="block truncate text-xs text-stardust-500 italic">{grove.subtitle}</span>
                    </span>
                    <Badge tone="info" icon={<span aria-hidden="true">✦</span>}>
                      {hits.length} {hits.length === 1 ? "module" : "modules"}
                    </Badge>
                    <span aria-hidden="true" className={`shrink-0 text-xs text-nova-300 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                      ▾
                    </span>
                  </button>
                  {isOpen && (
                    <div className="animate-rise space-y-2.5 border-t border-nova-400/10 px-3 py-3">
                      {hits.length === 0 ? (
                        <EmptyCategoryCard
                          categoryName={grove.name}
                          suggestion={
                            suggestion
                              ? { moduleName: suggestion.moduleName, reason: `in ${suggestion.groveName} is open for you.` }
                              : undefined
                          }
                        />
                      ) : (
                        hits.map((h) => (
                          <ModuleRow
                            key={h.mod.id}
                            hit={{ mod: h.mod, grove }}
                            visibility={h.visibility}
                            childSlug={childSlug}
                            onNavigate={onClose}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-stardust-500">
            {visibleByGrove.reduce((n, g) => n + g.hits.length, 0)} modules · growing one grove at a time
          </p>
        </>
      )}
    </BottomSheet>
  );
}
