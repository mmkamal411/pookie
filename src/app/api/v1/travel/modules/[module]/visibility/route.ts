// GET /api/v1/travel/modules/[module]/visibility — travel-scoped age
// visibility (API-layer enforcement of the menu/hub gating).
//
// Implements the pending rpc_travel_module_visibility contract directly —
// table-free (REAL support_user_age_band RPC), so no "initializing" state.
// module ∈ w25_fuel | w26_weather | w27_events | w28_restaurants |
//          w29_trails | w30_flights | w31_rental_cars
//
// w31_rental_cars → false for teen/child (hidden at menu, route, AND RPC).
// w30_flights is visible to all (planning) but purchase-gated separately.

import { handleRoute } from "@/server/rest";
import { failWith, ErrorCodes } from "@/server/errors";
import { createClient } from "@/lib/supabase/server";

const MODULES = [
  "w25_fuel",
  "w26_weather",
  "w27_events",
  "w28_restaurants",
  "w29_trails",
  "w30_flights",
  "w31_rental_cars",
] as const;

export const GET = handleRoute(async (ctx) => {
  const module = (ctx.params as { module?: string }).module ?? "";
  if (!(MODULES as readonly string[]).includes(module)) failWith(ErrorCodes.NOT_FOUND);

  const supabase = await createClient();
  let band = "child";
  try {
    const { data } = await supabase.rpc("support_user_age_band", { p_user_id: ctx.userId });
    if (data === "adult" || data === "teen" || data === "child") band = data;
  } catch {
    band = "child";
  }
  const isMinor = band === "teen" || band === "child";

  if (module === "w31_rental_cars" && isMinor) {
    return {
      module,
      visible: false,
      reason_code: "module_hidden_for_age_band",
      message: "This travel tool is for grown-ups.",
    };
  }
  if (module === "w30_flights") {
    return {
      module,
      visible: true,
      planning_only: isMinor,
      purchase_gated: true,
      message: isMinor ? "Flights need a grown-up to book." : null,
    };
  }
  return { module, visible: true, planning_only: false, purchase_gated: false };
});
