// GET /api/v1/travel/events?zip=&audience= — W27 Events (REDESIGNED).
//
// The `events` table + rpc_get_events are Squad 1's (PENDING per
// BACKEND-CONTRACTS §6.2; migrations frozen by MD). This route codes against
// that contract: when the table exists it serves real rows with server-side
// age-tag filtering; until then it returns an honest "service initializing"
// state — never invented events (BACKLOG S5-009 anti-criteria).
//
// Panel rules (FR-MOD-W27) enforced here when data exists:
//  - host_type ∈ ticketed_public | municipal | school | nonprofit | verified_host
//  - is_private_residence rows are excluded, always
//  - 18+/21+ rows excluded for <18 (server-side); <13 → all_ages/family only

import { handleRoute } from "@/server/rest";
import { ApiError, ErrorCodes, failWith } from "@/server/errors";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_HOST_TYPES = ["ticketed_public", "municipal", "school", "nonprofit", "verified_host"];

export const GET = handleRoute(async (_ctx, req) => {
  const params = new URL(req.url).searchParams;
  const zip = (params.get("zip") ?? "").trim();
  if (!/^\d{5}$/.test(zip)) failWith(ErrorCodes.VALIDATION_FAILED);
  const audience = params.get("audience") ?? "family";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Server-side age band for the age-tag filter (REAL 033 RPC; fail closed).
  let band: string = "child";
  try {
    if (user) {
      const { data } = await supabase.rpc("support_user_age_band", { p_user_id: user.id });
      if (typeof data === "string") band = data;
    }
  } catch {
    band = "child";
  }
  const isAdult = band === "adult";

  // Audience modes: teen accounts cannot select "grown_up" (UX-SPECS §1.3).
  const audienceMode = audience === "grown_up" && !isAdult ? "family" : audience;

  try {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, description, starts_at, ends_at, venue_name, venue_city, age_tag, host_type, source_url, audience")
      .eq("is_private_residence", false)
      .in("host_type", ALLOWED_HOST_TYPES)
      .order("starts_at", { ascending: true })
      .limit(50);
    if (error) throw error;

    let rows = data ?? [];
    // Age-tag filtering, server-side (never UI-only).
    rows = rows.filter((r) => {
      const tag = (r as { age_tag?: string }).age_tag ?? "all_ages";
      if (!isAdult && (tag === "18+" || tag === "21+")) return false;
      if (band === "child" && tag !== "all_ages") return false;
      return true;
    });
    if (audienceMode !== "all") {
      rows = rows.filter((r) => {
        const a = (r as { audience?: string }).audience ?? "family";
        return a === audienceMode || a === "all";
      });
    }
    return {
      status: "ok",
      events: rows,
      audience: audienceMode,
      band,
      curation_policy:
        "Every event here is vetted — public venues, schools, city events, and verified hosts only. Never private homes. Never 'DM for address'.",
      source: "Municipal and verified-host calendars",
    };
  } catch (err) {
    // Missing table (42P01) or any schema mismatch → honest initializing state.
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof ApiError) throw err;
    if (/relation .* does not exist|42P01|column .* does not exist|42703/i.test(msg)) {
      return {
        status: "service_initializing",
        message:
          "The events catalog is still being connected — municipal calendars (Cobb Parks & Rec, Marietta) are being wired up. Check back soon.",
        audience: audienceMode,
        band,
        curation_policy:
          "Every event here is vetted — public venues, schools, city events, and verified hosts only. Never private homes. Never 'DM for address'.",
        events: [],
      };
    }
    throw new ApiError(ErrorCodes.UPSTREAM_UNAVAILABLE);
  }
});
