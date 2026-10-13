// Nudge surface — client-safe half: canonical types + pure helpers.
// The server read path (getNudges) lives in ./nudges-server — importing
// next/headers' cookies() into a client bundle breaks the build.

import type { Nudge } from "@/lib/automation/types";

export type { Nudge };
export type { NudgeTier, NudgeAction } from "@/lib/automation/types";

/** Banner-tier nudges, top priority first — the banner lane shows one. */
export function bannerNudges(nudges: Nudge[]): Nudge[] {
  return nudges
    .filter((n) => n.tier === "banner")
    .sort((a, b) => b.priority - a.priority);
}
