// /api/v1/me/layout-plan — the adaptive cockpit's design plan.
// GET: the current LayoutPlan for the pilot's household. Falls back to a
// static solo-operator plan when the nightly cycle hasn't produced one yet —
// the cockpit never renders a blank.
// PUT: pilot overrides (lock a panel's position, hide a panel). The AI
// proposes; the pilot disposes — overrides always win over AI scoring.
import { z } from "zod";
import { handleRoute } from "@/server/rest";
import { createClient } from "@/lib/supabase/server";
import type { LayoutOverride, LayoutPlan } from "@/lib/automation/types";

const STATIC_FALLBACK: LayoutPlan = {
  version: 1,
  template: "solo-operator",
  generatedAt: new Date().toISOString(),
  panels: [
    { id: "today", title: "Today", route: null, rank: 1, highlight: false, reason: "your daily cockpit", locked: false, signalScore: 50 },
    { id: "W7", title: "Money", route: "/household/vault", rank: 2, highlight: false, reason: "your daily cockpit", locked: false, signalScore: 50 },
    { id: "W2", title: "Health", route: "/health", rank: 3, highlight: false, reason: "your daily cockpit", locked: false, signalScore: 50 },
    { id: "W20", title: "Shopping", route: "/household/shopping", rank: 4, highlight: false, reason: "your daily cockpit", locked: false, signalScore: 50 },
    { id: "W21", title: "Mail", route: "/household/mail", rank: 5, highlight: false, reason: "your daily cockpit", locked: false, signalScore: 50 },
  ],
  spotlight: null,
  overridesApplied: 0,
};

export const GET = handleRoute(async (ctx) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cockpit_layout_plans")
    .select("plan")
    .eq("household_id", ctx.userId)
    .maybeSingle();
  const plan = (data as { plan: LayoutPlan } | null)?.plan;
  return { plan: plan ?? STATIC_FALLBACK };
});

const putSchema = z.object({
  overrides: z
    .array(
      z.object({
        panelId: z.string().min(1).max(50),
        lockedPosition: z.number().int().min(1).max(50).nullable(),
        hidden: z.boolean(),
      }),
    )
    .max(50),
});

export const PUT = handleRoute(async (ctx, req) => {
  const { overrides } = putSchema.parse(await req.json());
  const supabase = await createClient();
  const rows: (LayoutOverride & { household_id: string })[] = overrides.map((o) => ({
    household_id: ctx.userId,
    panelId: o.panelId,
    lockedPosition: o.lockedPosition,
    hidden: o.hidden,
  }));
  // The table uses snake_case columns; map explicitly.
  const { error } = await supabase.from("cockpit_layout_overrides").upsert(
    rows.map((r) => ({
      household_id: r.household_id,
      panel_id: r.panelId,
      locked_position: r.lockedPosition,
      hidden: r.hidden,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "household_id,panel_id" },
  );
  if (error) throw error;
  return { ok: true as const, overridesApplied: rows.length };
});
