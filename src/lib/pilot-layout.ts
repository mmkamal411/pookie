// Pilot layout plan — client-safe half: types, default plan, and the
// architect-plan mapper (pure). The server read path (getPilotLayoutPlan)
// lives in ./pilot-layout-server — it imports next/headers via the
// Supabase server client, so it must never be imported by a client
// component.
//
// The canonical plan lives with the architect (src/lib/automation/*,
// GET /api/v1/me/layout-plan). This module maps it onto the opening pane's
// three zones:
//
//   architect panel            opening zone      why
//   "today" (tasks focus)  →   todo            today's to-dos live here
//   "W7" (money / bills)   →   calendar        bills surface in the week view
//   weather                →   weather         fixed anchor — never moves
//                                            (visual spec §4)
//
// Panels with no zone mapping (school, shopping, mail, health, travel)
// drive the deeper cockpit (Stations menu, Crew hub), not the opening pane.

import type { LayoutPlan as ArchitectPlan } from "@/lib/automation/types";

export type PanelId = "weather" | "todo" | "calendar";

export interface PanelState {
  /** Zone id — must exist in the panel registry. */
  id: PanelId;
  /** Position in the opening pane, 0 = top. */
  order: number;
  /** AI-highlighted (a nudge or the layout plan points here). */
  highlighted?: boolean;
  /** Locked zones never move on AI re-plans — pilot's explicit choice. */
  locked?: boolean;
}

export interface LayoutPlan {
  version: 1;
  panels: PanelState[];
}

/** The calm default: weather → to-do → calendar (Meheldi 2026-10-12). */
export const DEFAULT_PLAN: LayoutPlan = {
  version: 1,
  panels: [
    { id: "weather", order: 0 },
    { id: "todo", order: 1 },
    { id: "calendar", order: 2 },
  ],
};

/** Map the architect's module plan onto the opening pane's three zones. */
export function fromArchitectPlan(plan: ArchitectPlan): LayoutPlan {
  const byId = new Map(plan.panels.map((p) => [p.id, p]));
  const today = byId.get("today");
  const money = byId.get("W7");

  const zones: { id: PanelId; rank: number; highlighted: boolean }[] = [
    // Weather is the fixed anchor (visual spec §4) — always first.
    { id: "weather", rank: 0, highlighted: false },
    { id: "todo", rank: today?.rank ?? 2, highlighted: today?.highlight === true },
    { id: "calendar", rank: money?.rank ?? 3, highlighted: money?.highlight === true },
  ];
  // Weather keeps order 0; the other zones sort by mapped rank.
  const rest = zones.filter((z) => z.id !== "weather").sort((a, b) => a.rank - b.rank);
  const ordered: PanelState[] = [
    { id: "weather", order: 0, highlighted: false },
    ...rest.map((z, i) => ({
      id: z.id,
      order: i + 1,
      highlighted: z.highlighted || undefined,
    })),
  ];
  return { version: 1, panels: ordered };
}
