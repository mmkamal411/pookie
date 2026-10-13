"use client";

import { useEffect, useMemo, useState } from "react";
import type { LayoutPlan, PanelId, PanelState } from "@/lib/pilot-layout";
import type { Nudge } from "@/lib/nudges";
import { NudgeBanner } from "./nudge-banner";
import { WeatherPanel } from "./panels/weather-panel";
import { TodoPanel } from "./panels/todo-panel";
import { CalendarPanel } from "./panels/calendar-panel";

const STORAGE_KEY = "pookie:pilot-layout:v1";

interface SectionProps {
  highlighted?: boolean;
  bare?: boolean;
  expandable?: boolean;
}

/** Panel id → the section component. New AI-placeable panels register here
 *  (and in the PanelId union in lib/pilot-layout.ts). */
const PANEL_COMPONENTS: Record<PanelId, (p: SectionProps) => React.JSX.Element> = {
  weather: WeatherPanel,
  todo: TodoPanel,
  calendar: CalendarPanel,
};

interface PilotOverrides {
  order?: PanelId[];
  locked?: PanelId[];
  highlightsCleared?: string[];
}

function readOverrides(): PilotOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as PilotOverrides;
    return {
      order: Array.isArray(o.order) ? o.order.filter((id): id is PanelId => id in PANEL_COMPONENTS) : undefined,
      locked: Array.isArray(o.locked) ? o.locked.filter((id): id is PanelId => id in PANEL_COMPONENTS) : undefined,
      highlightsCleared: Array.isArray(o.highlightsCleared) ? o.highlightsCleared.filter((x) => typeof x === "string") : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Which opening-pane zone a nudge points at (panel-highlight pattern).
 * The architect's watchers/actions speak in module terms; this maps the
 * ones with a home on the opening pane.
 */
function zoneForNudge(n: Nudge): PanelId | null {
  if (n.action?.kind === "task.complete") return "todo";
  if (n.action?.kind === "bill.mark-paid") return "calendar";
  if (n.watcher === "bill-due") return "calendar";
  return null;
}

/**
 * AdaptiveDashboard — the opening glass pane (Meheldi 2026-10-12 ~22:28,
 * final composition): ONE calm glass pane with weather + calendar visible
 * and the to-do section expanding for details, over the live planetary
 * vista. The pane's sections render from the AI's layout plan (order +
 * highlights, mapped server-side in getPilotLayoutPlan); the "Overnight
 * by Pookie" feed below shows what the background AI handled.
 *
 * The pilot can rearrange (up/down) and lock sections; pilot choices
 * persist in localStorage and ALWAYS win over AI moves. The arrange
 * controls hide behind one subtle toggle so the pane stays calm.
 */
export function AdaptiveDashboard({
  initialPlan,
  nudges,
}: {
  initialPlan: LayoutPlan;
  nudges: Nudge[];
}) {
  const [overrides, setOverrides] = useState<PilotOverrides>({});
  const [hydrated, setHydrated] = useState(false);
  const [arranging, setArranging] = useState(false);

  useEffect(() => {
    setOverrides(readOverrides());
    setHydrated(true);
  }, []);

  function persist(next: PilotOverrides) {
    setOverrides(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode etc. — the plan still renders, just not remembered.
    }
  }

  const panels: PanelState[] = useMemo(() => {
    const base = [...initialPlan.panels].sort((a, b) => a.order - b.order);
    const order = overrides.order;
    const locked = new Set(overrides.locked ?? []);
    let list = base;
    if (order && order.length > 0) {
      const byId = new Map(base.map((p) => [p.id, p]));
      const ordered = order.map((id) => byId.get(id)).filter((p): p is PanelState => !!p);
      const rest = base.filter((p) => !order.includes(p.id));
      list = [...ordered, ...rest];
    }
    return list.map((p) => ({
      ...p,
      locked: p.locked || locked.has(p.id),
    }));
  }, [initialPlan, overrides]);

  // Section highlights: the AI plan's flags (server-mapped) + live nudges
  // pointing at a zone. The pilot clears them with "✓ seen".
  const cleared = useMemo(() => new Set(overrides.highlightsCleared ?? []), [overrides]);
  const highlightedPanels = useMemo(() => {
    const set = new Set<PanelId>();
    for (const p of initialPlan.panels) {
      if (p.highlighted && !cleared.has(`plan:${p.id}`)) set.add(p.id);
    }
    for (const n of nudges) {
      if (n.status !== "pending") continue;
      const zone = zoneForNudge(n);
      if (zone && n.id && !cleared.has(`nudge:${n.id}`)) set.add(zone);
    }
    return set;
  }, [initialPlan, nudges, cleared]);

  function move(id: PanelId, dir: -1 | 1) {
    const ids = panels.map((p) => p.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    if (panels[i].locked || panels[j].locked) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    persist({ ...overrides, order: next });
  }

  function toggleLock(id: PanelId) {
    const locked = new Set(overrides.locked ?? []);
    if (locked.has(id)) locked.delete(id);
    else locked.add(id);
    persist({ ...overrides, locked: [...locked] });
  }

  function clearHighlight(panelId: PanelId) {
    const keys = [`plan:${panelId}`];
    for (const n of nudges) {
      if (zoneForNudge(n) === panelId && n.id) keys.push(`nudge:${n.id}`);
    }
    persist({ ...overrides, highlightsCleared: [...cleared, ...keys] });
  }

  return (
    <div className="mt-6 space-y-4">
      <NudgeBanner nudges={nudges} />

      {hydrated && (
        <div className="opening-pane">
          <div className="flex items-center justify-between px-1 pb-1">
            <p className="text-[10px] font-semibold tracking-[0.25em] text-stardust-400 uppercase">
              Flight plan
            </p>
            <button
              type="button"
              onClick={() => setArranging((a) => !a)}
              aria-expanded={arranging}
              className="rounded-full px-3 py-1 text-[11px] text-stardust-400 transition hover:bg-white/10 hover:text-stardust-200"
            >
              {arranging ? "Done" : "Arrange"}
            </button>
          </div>

          {panels.map((p, idx) => {
            const View = PANEL_COMPONENTS[p.id];
            if (!View) return null;
            const highlighted = highlightedPanels.has(p.id);
            return (
              <div key={p.id}>
                {idx > 0 && (
                  <div aria-hidden="true" className="mx-1 my-2 border-t border-white/[0.07]" />
                )}
                <div className="relative">
                  <View bare highlighted={highlighted} expandable={p.id === "todo"} />
                  <div className="absolute top-1 right-1 flex items-center gap-0.5">
                    {highlighted && (
                      <button
                        type="button"
                        onClick={() => clearHighlight(p.id)}
                        title="Clear highlight"
                        aria-label="Clear highlight"
                        className="rounded-full px-2 py-1 text-[10px] text-pulse-300/90 transition hover:bg-white/10 hover:text-pulse-200"
                      >
                        ✓ seen
                      </button>
                    )}
                    {arranging && (
                      <>
                        <button
                          type="button"
                          onClick={() => move(p.id, -1)}
                          disabled={idx === 0 || p.locked}
                          title="Move section up"
                          aria-label="Move section up"
                          className="rounded-full px-1.5 py-1 text-[11px] text-stardust-500 transition hover:bg-white/10 hover:text-stardust-200 disabled:opacity-25"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(p.id, 1)}
                          disabled={idx === panels.length - 1 || p.locked}
                          title="Move section down"
                          aria-label="Move section down"
                          className="rounded-full px-1.5 py-1 text-[11px] text-stardust-500 transition hover:bg-white/10 hover:text-stardust-200 disabled:opacity-25"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleLock(p.id)}
                          title={p.locked ? "Unlock section" : "Lock section in place"}
                          aria-label={p.locked ? "Unlock section" : "Lock section in place"}
                          aria-pressed={!!p.locked}
                          className={`rounded-full px-1.5 py-1 text-[11px] transition hover:bg-white/10 ${
                            p.locked ? "text-pulse-300" : "text-stardust-500 hover:text-stardust-200"
                          }`}
                        >
                          {p.locked ? "🔒" : "🔓"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{OPENING_PANE_CSS}</style>
    </div>
  );
}

const OPENING_PANE_CSS = `
.opening-pane {
  border-radius: 24px;
  border: 1px solid rgb(255 255 255 / 0.12);
  background: linear-gradient(180deg, rgb(10 16 28 / 0.72), rgb(6 10 20 / 0.78));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: 0 24px 80px rgb(0 0 0 / 0.45), 0 0 44px rgb(0 229 255 / 0.06), inset 0 1px 0 rgb(255 255 255 / 0.06);
  padding: 20px;
}
@media (prefers-reduced-motion: reduce) {
  .opening-pane { backdrop-filter: none; -webkit-backdrop-filter: none; }
}
`;
