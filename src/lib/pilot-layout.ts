// Pilot layout plan — the adaptive cockpit contract (Meheldi 2026-10-12).
//
// The opening glass pane does NOT hardcode its composition. It renders from
// a LayoutPlan: which zones, in what order, what's highlighted. The
// background AI (automation architect's layout engine) proposes the plan;
// the pilot can rearrange and lock zones, and pilot locks always win.
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

import { createClient } from "@/lib/supabase/server";
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

/**
 * Server entry point for the pilot's opening-pane plan.
 *
 * Reads the architect's layout plan (same query as GET /api/v1/me/layout-plan)
 * and maps it onto the three opening zones. Weather stays anchored first;
 * todo/calendar follow the mapped ranks. Any failure → DEFAULT_PLAN, never
 * a blank pane. Pilot locks (localStorage, applied client-side in
 * AdaptiveDashboard) always take precedence over AI moves.
 */
export async function getPilotLayoutPlan(): Promise<LayoutPlan> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return DEFAULT_PLAN;
    const { data } = await supabase
      .from("cockpit_layout_plans")
      .select("plan")
      .eq("household_id", user.id)
      .maybeSingle();
    const plan = (data as { plan: ArchitectPlan } | null)?.plan;
    if (!plan || !Array.isArray(plan.panels)) return DEFAULT_PLAN;
    return fromArchitectPlan(plan);
  } catch {
    return DEFAULT_PLAN;
  }
}

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
