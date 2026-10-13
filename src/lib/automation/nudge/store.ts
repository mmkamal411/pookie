// Nudge persistence — Supabase implementation of the engine's NudgeStore.
// Server-only (service-role). Writes carry an explicit household id because
// RLS is bypassed in the automation host.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Nudge } from "../types";
import type { NudgeStore } from "./engine";

interface NudgeRow {
  id: string;
  dedup_key: string;
  status: string;
  dismissed_at: string | null;
}

function toRow(n: Nudge): Record<string, unknown> {
  return {
    household_id: n.householdId,
    watcher: n.watcher,
    tier: n.tier,
    priority: n.priority,
    title: n.title,
    detail: n.detail,
    approval: n.approval,
    action: n.action,
    status: "pending",
    dedup_key: n.dedupKey,
  };
}

export const supabaseNudgeStore: NudgeStore = {
  async existingDedupKeys(householdId: string, keys: string[]): Promise<Set<string>> {
    if (keys.length === 0) return new Set();
    const { data } = await supabaseAdmin
      .from("automation_nudges")
      .select("dedup_key")
      .eq("household_id", householdId)
      .in("dedup_key", keys);
    return new Set(((data ?? []) as { dedup_key: string }[]).map((r) => r.dedup_key));
  },

  async recentlyDismissed(householdId: string, keys: string[]): Promise<Set<string>> {
    if (keys.length === 0) return new Set();
    const { data } = await supabaseAdmin
      .from("automation_nudges")
      .select("dedup_key")
      .eq("household_id", householdId)
      .eq("status", "dismissed")
      .in("dedup_key", keys);
    return new Set(((data ?? []) as { dedup_key: string }[]).map((r) => r.dedup_key));
  },

  async insert(nudges: Nudge[]): Promise<number> {
    if (nudges.length === 0) return 0;
    // onConflict: do nothing — the unique (household_id, dedup_key) index
    // makes double-fires a no-op instead of an error.
    const { data, error } = await supabaseAdmin
      .from("automation_nudges")
      .upsert(nudges.map(toRow), { onConflict: "household_id,dedup_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    return (data as { id: string }[] | null)?.length ?? 0;
  },
};

/** Feed read for the dashboard — user-scoped client, RLS enforced. */
export async function listNudgesForHousehold(
  supabase: SupabaseClient,
  householdId: string,
  limit = 20,
): Promise<Nudge[]> {
  const { data, error } = await supabase
    .from("automation_nudges")
    .select(
      "id,watcher,tier,priority,title,detail,approval,action,status,dedup_key,created_at,read_at",
    )
    .eq("household_id", householdId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    householdId,
    watcher: r.watcher as string,
    tier: r.tier as Nudge["tier"],
    priority: r.priority as number,
    title: r.title as string,
    detail: r.detail as string,
    approval: r.approval as Nudge["approval"],
    action: r.action as Nudge["action"],
    status: r.status as Nudge["status"],
    dedupKey: r.dedup_key as string,
    createdAt: r.created_at as string,
    readAt: r.read_at as string | null,
  }));
}

export type { NudgeRow };
