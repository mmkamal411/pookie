// GET /api/v1/household/weather?zip= — W26 standalone Weather module.
//
// Keyless: NWS api.weather.gov primary, Open-Meteo fallback. The client
// passes the stored home ZIP (localStorage "pookie.travel.zip", shared with
// the travel module); when absent the route defaults to the household home
// ZIP 30067 (Marietta, GA) and flags `defaulted` so the UI can say so.
// Forecasts and alerts come only from NWS — never LLM-generated. Always
// carries the "not an emergency-alert system" contract flag for the UI
// disclaimer. D7: ZIP input only (coarse location); nothing precise accepted.

import { handleRoute } from "@/server/rest";
import { ApiError, ErrorCodes } from "@/server/errors";
import { getHouseholdWeather } from "@/server/services/weather";

/** Home ZIP default when the client sends none. */
const HOME_ZIP = "30067"; // Marietta, GA — the household's home sky

export const GET = handleRoute(async (_ctx, req) => {
  const raw = (new URL(req.url).searchParams.get("zip") ?? "").trim();
  const zip = /^\d{5}$/.test(raw) ? raw : HOME_ZIP;
  const defaulted = !/^\d{5}$/.test(raw);

  try {
    const data = await getHouseholdWeather(zip);
    return {
      ...data,
      defaulted,
      not_emergency_system: true,
    };
  } catch (err) {
    // resolveZip throws on bad ZIP — 404, never confirm/deny internals.
    if (err instanceof Error && /bad_zip|zip_not_found/.test(err.message)) {
      throw new ApiError(ErrorCodes.NOT_FOUND);
    }
    throw new ApiError(ErrorCodes.UPSTREAM_UNAVAILABLE);
  }
});
