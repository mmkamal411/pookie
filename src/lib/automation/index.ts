// Background AI — registry + cycle runner.
// The single entry point for the automation host (cron route, worker, or
// Edge Function): runAutomationCycle() collects signals per household,
// runs every registered watcher through the nudge engine, and refreshes
// the layout plan on the nightly cadence.

import { randomUUID } from "crypto";
import { emitAutomationEvent } from "./bus";
import { collectSignals, listHouseholds } from "./signals";
import { deliverWatcher } from "./nudge/engine";
import { supabaseNudgeStore } from "./nudge/store";
import { billDueWatcher } from "./nudge/watchers/bill-due";
import { generateLayoutPlan } from "./layout/engine";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  AutomationOutcome,
  CycleResult,
  HouseholdSignals,
  Watcher,
} from "./types";

// Re-exported so route handlers don't reach past this barrel.
export type { Watcher };
export { generateLayoutPlan };
export { billDueWatcher };

/** All watchers, in evaluation order. Add new watchers here (phase 2). */
const WATCHERS: Watcher[] = [billDueWatcher];

/** The nudge engine's store. Swappable for tests. */
let storeOverride: typeof supabaseNudgeStore | null = null;
export function setNudgeStoreForTests(
  store: typeof supabaseNudgeStore | null,
): void {
  storeOverride = store;
}

async function refreshLayoutPlan(signals: HouseholdSignals): Promise<boolean> {
  try {
    const { data: overrides } = await supabaseAdmin
      .from("cockpit_layout_overrides")
      .select("panel_id,locked_position,hidden")
      .eq("household_id", signals.householdId);
    const plan = generateLayoutPlan(
      signals,
      ((overrides ?? []) as {
        panel_id: string;
        locked_position: number | null;
        hidden: boolean;
      }[]).map((o) => ({
        panelId: o.panel_id,
        lockedPosition: o.locked_position,
        hidden: o.hidden,
      })),
    );
    // One current plan per household — recomputed, never appended.
    const { error } = await supabaseAdmin.from("cockpit_layout_plans").upsert(
      {
        household_id: signals.householdId,
        plan,
        template: plan.template,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "household_id" },
    );
    return !error;
  } catch {
    return false;
  }
}

export interface CycleOptions {
  /** When true, refresh layout plans too (nightly cadence). Default false. */
  refreshLayout?: boolean;
}

export async function runAutomationCycle(
  options: CycleOptions = {},
): Promise<CycleResult> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  emitAutomationEvent("automation.cycle-started", "system", { runId });

  const store = storeOverride ?? supabaseNudgeStore;
  const households = await collectHouseholds();
  const outcomes: AutomationOutcome[] = [];
  let layoutPlansRefreshed = 0;

  for (const householdId of households) {
    let signals: HouseholdSignals;
    try {
      signals = await collectSignals(householdId);
    } catch (err) {
      outcomes.push({
        watcher: "*signals*",
        evaluated: 0,
        delivered: 0,
        skippedQuietHours: 0,
        deduped: 0,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    const now = new Date();
    for (const watcher of WATCHERS) {
      const report = await deliverWatcher(watcher, signals, now, store);
      outcomes.push({
        watcher: `${householdId.slice(0, 8)}:${watcher.name}`,
        evaluated: report.evaluated,
        delivered: report.delivered,
        skippedQuietHours: report.skippedQuietHours,
        deduped: report.deduped,
        error: report.error,
      });
      if (report.error) {
        emitAutomationEvent("automation.watcher-failed", householdId, {
          watcher: watcher.name,
          error: report.error,
        });
      }
    }
    if (options.refreshLayout && (await refreshLayoutPlan(signals))) {
      layoutPlansRefreshed += 1;
    }
  }

  const finishedAt = new Date().toISOString();
  emitAutomationEvent("automation.cycle-finished", "system", {
    runId,
    households: households.length,
  });
  return {
    runId,
    startedAt,
    finishedAt,
    households: households.length,
    outcomes,
    layoutPlansRefreshed,
  };
}

async function collectHouseholds(): Promise<string[]> {
  try {
    return await listHouseholds();
  } catch {
    return [];
  }
}
