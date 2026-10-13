// Nudge surface — server-only read path for the opening page.
// (Split from ./nudges: this imports next/headers via the Supabase server
// client, so it must never be imported by a client component.)

import { createClient } from "@/lib/supabase/server";
import { listNudgesForHousehold } from "@/lib/automation/nudge/store";
import type { Nudge } from "@/lib/automation/types";

/**
 * Pending nudges for the pilot's household, highest priority first.
 * Never throws — a missing table or a failed read yields [] (the banner
 * stays quiet; the feed component shows its own honest states).
 *
 * Child-kind nudges are only ever produced when the pilot has linked
 * children (the architect's watchers check signals.childrenLinked) —
 * user-first: never assume parenthood.
 */
export async function getNudges(): Promise<Nudge[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const nudges = await listNudgesForHousehold(supabase, user.id, 20);
    return nudges.filter((n) => n.status === "pending");
  } catch {
    return [];
  }
}
