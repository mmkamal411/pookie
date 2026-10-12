// POST /api/v1/travel/purchase/check — FR-TRAVEL-001 purchase gate.
//
// Server-side invariant (never UI-only): purchaser-of-record must be 18+.
// Every denied attempt on a real booking path writes an audit row
// (log_access_event, event_type='request_denied'). This route implements the
// pending rpc_travel_purchase_check contract directly — the logic is
// table-free (REAL support_user_age_band RPC), so no "initializing" state.

import { z } from "zod";
import { handleRoute } from "@/server/rest";
import { failWith, ErrorCodes } from "@/server/errors";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  flow: z.enum(["flight", "rental_car", "event_ticket"]),
});

export const POST = handleRoute(async (ctx, req) => {
  const { flow } = bodySchema.parse(await req.json());
  const supabase = await createClient();

  let band = "child";
  try {
    const { data } = await supabase.rpc("support_user_age_band", { p_user_id: ctx.userId });
    if (data === "adult" || data === "teen" || data === "child") band = data;
  } catch {
    band = "child";
  }

  const isMinor = band === "teen" || band === "child";
  const reasonCode =
    flow === "rental_car" && isMinor ? "rental_car_teen_hidden" : "minor_purchaser_blocked";

  if (isMinor) {
    // Audit every denied attempt (FR-TRAVEL-001).
    try {
      await supabase.rpc("log_access_event", {
        p_child_id: null,
        p_actor_user_id: ctx.userId,
        p_event_type: "request_denied",
        p_subject_user_id: null,
        p_metadata: { flow, reason_code: reasonCode },
        p_amount_cents: null,
      });
    } catch {
      // Audit is best-effort; the denial stands regardless.
    }
    const message =
      flow === "rental_car"
        ? "Rental cars need a grown-up to book."
        : flow === "flight"
          ? "Flights need a grown-up to book."
          : "Tickets need a grown-up to buy.";
    return { allowed: false, reason_code: reasonCode, message, requires_adult: true };
  }

  if (flow === "rental_car") {
    // Adult 18–20: planning mode only (most companies rent at 21+).
    return { allowed: true, planning_mode_only: true, requires_adult: true };
  }
  return { allowed: true, requires_adult: false };
});

export const GET = handleRoute(async () => {
  failWith(ErrorCodes.VALIDATION_FAILED);
});
