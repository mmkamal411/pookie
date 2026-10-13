// /api/v1/me/nudges — the background AI's activity feed.
// GET: pending feed items for the pilot's household ("Overnight by Pookie").
// PATCH: mark a nudge acted or dismissed. Dismissal is ledger-like — the row
// stays, so the watcher cooldown can honor it.
import { z } from "zod";
import { handleRoute } from "@/server/rest";
import { createClient } from "@/lib/supabase/server";
import { listNudgesForHousehold } from "@/lib/automation/nudge/store";

export const GET = handleRoute(async (ctx) => {
  const supabase = await createClient();
  const nudges = await listNudgesForHousehold(supabase, ctx.userId, 20);
  return { nudges: nudges.filter((n) => n.status === "pending") };
});

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["acted", "dismissed"]),
});

export const PATCH = handleRoute(async (ctx, req) => {
  const { id, status } = patchSchema.parse(await req.json());
  const supabase = await createClient();
  const patch =
    status === "dismissed"
      ? { status, dismissed_at: new Date().toISOString() }
      : { status, read_at: new Date().toISOString() };
  const { error } = await supabase
    .from("automation_nudges")
    .update(patch)
    .eq("id", id)
    .eq("household_id", ctx.userId);
  if (error) throw error;
  return { ok: true as const };
});
