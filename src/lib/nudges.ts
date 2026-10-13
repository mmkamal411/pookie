// Nudge surface — the proactive AI's voice (Meheldi 2026-10-12).
//
// The AI works in the BACKGROUND and speaks up through the day: meetings,
// bills, groceries, a child's homework (only when the pilot has children).
// Two surfaces (visual spec §7): the banner lane (time-critical, tier
// "banner") and the "Overnight by Pookie" feed (the rest).
//
// The canonical Nudge type + producer live with the AI automation architect
// (src/lib/automation/*). This module is the frontend's read path:
// getNudges() returns the pending feed for the opening page.

import { createClient } from "@/lib/supabase/server";
import { listNudgesForHousehold } from "@/lib/automation/nudge/store";
import type { Nudge } from "@/lib/automation/types";

export type { Nudge };
export type { NudgeTier, NudgeAction } from "@/lib/automation/types";

/**
 * Server read path for the opening page: pending nudges for the pilot's
 * household, highest priority first. Never throws — a missing table or a
 * failed read yields [] (the banner simply stays quiet; the feed component
 * shows its own honest empty/error states client-side).
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

/** Banner-tier nudges, top priority first — the banner lane shows one. */
export function bannerNudges(nudges: Nudge[]): Nudge[] {
  return nudges
    .filter((n) => n.tier === "banner")
    .sort((a, b) => b.priority - a.priority);
}
