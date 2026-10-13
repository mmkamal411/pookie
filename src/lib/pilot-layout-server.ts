// Pilot layout plan — server-only read path for the opening page.
// (Split from ./pilot-layout: this imports next/headers via the Supabase
// server client, so it must never be imported by a client component.)

import { createClient } from "@/lib/supabase/server";
import type { LayoutPlan as ArchitectPlan } from "@/lib/automation/types";
import { DEFAULT_PLAN, fromArchitectPlan, type LayoutPlan } from "./pilot-layout";

/**
 * The pilot's opening-pane plan.
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
