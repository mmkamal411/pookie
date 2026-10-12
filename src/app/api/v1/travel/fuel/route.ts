// GET /api/v1/travel/fuel?zip=&fuel_type=gas|diesel — W25 Fuel (real EIA data).
//
// EIA v2 API (EIA_API_KEY, free at eia.gov/opendata). EIA's free series carry
// AREA AVERAGES (PADD/region), not per-station prices — the response says so
// honestly ("regional average" label) and never fabricates station rows.
// Station-level search is a future vendor integration, not faked.
// Missing key → honest "configuration needed" (NO-PLACEHOLDERS §1).

import { handleRoute } from "@/server/rest";
import { ApiError, ErrorCodes, failWith } from "@/server/errors";
import { cacheGet, cacheSet, resolveZip, upstreamGet } from "@/lib/travel/upstream";

interface EiaResponse {
  response: { data: { period: string; series: string; value: string }[] };
}

const SERIES: Record<string, string> = {
  // EIA v2 petroleum retail series (weekly, dollars per gallon).
  gas: "PET.PRI_GND.A.EPM0_PTE.DPG.W", // US regular gasoline, retail
  diesel: "PET.PRI_GND.A.EPM0D_PTE.DPG.W", // US on-highway diesel, retail
};

export const GET = handleRoute(async (_ctx, req) => {
  const params = new URL(req.url).searchParams;
  const zip = (params.get("zip") ?? "").trim();
  const fuelType = (params.get("fuel_type") ?? "gas").trim();
  if (!/^\d{5}$/.test(zip)) failWith(ErrorCodes.VALIDATION_FAILED);
  if (!SERIES[fuelType]) failWith(ErrorCodes.VALIDATION_FAILED);

  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    return {
      status: "configuration_needed",
      message:
        "Fuel prices need an EIA API key (free at eia.gov/opendata). The integration is complete — only the credential is missing.",
    };
  }

  let point;
  try {
    point = await resolveZip(zip);
  } catch {
    throw new ApiError(ErrorCodes.NOT_FOUND);
  }

  const cacheKey = `fuel:${fuelType}`;
  const cached = cacheGet<{ value: number; period: string }>(cacheKey);
  if (cached) {
    return {
      status: "ok",
      location: { zip: point.zip, city: point.city, state: point.state },
      fuel_type: fuelType,
      price_per_gallon: cached.value,
      period: cached.period,
      granularity: "regional_average",
      granularity_note:
        "Regional average from the U.S. Energy Information Administration — not a per-station price.",
      source: "U.S. Energy Information Administration (eia.gov/opendata)",
    };
  }

  try {
    const url =
      `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${encodeURIComponent(apiKey)}` +
      `&frequency=weekly&data[0]=value&facets[series][]=${encodeURIComponent(SERIES[fuelType])}` +
      `&sort[0][column]=period&sort[0][direction]=desc&length=1`;
    const json = await upstreamGet<EiaResponse>(url);
    const row = json.response?.data?.[0];
    if (!row) throw new Error("upstream_unavailable");
    const value = Number.parseFloat(row.value);
    if (!Number.isFinite(value)) throw new Error("upstream_unavailable");
    cacheSet(cacheKey, { value, period: row.period }, 24 * 60 * 60 * 1000); // contract TTL: 24h
    return {
      status: "ok",
      location: { zip: point.zip, city: point.city, state: point.state },
      fuel_type: fuelType,
      price_per_gallon: value,
      period: row.period,
      granularity: "regional_average",
      granularity_note:
        "Regional average from the U.S. Energy Information Administration — not a per-station price.",
      source: "U.S. Energy Information Administration (eia.gov/opendata)",
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(ErrorCodes.UPSTREAM_UNAVAILABLE);
  }
});
