// GET /api/v1/travel/chargers?zip=&radius_mi= — W25 EV charging (real
// OpenChargeMap POIs). The query point is the ZIP centroid (D7 coarse
// location) — never the user's precise position. Missing key → honest
// "configuration needed".

import { handleRoute } from "@/server/rest";
import { ApiError, ErrorCodes, failWith } from "@/server/errors";
import { cacheGet, cacheSet, resolveZip, upstreamGet } from "@/lib/travel/upstream";

interface OcmPoi {
  ID: number;
  AddressInfo: { Title: string; AddressLine1?: string; Town?: string; StateOrProvince?: string };
  Connections?: { ConnectionType?: { Title: string }; PowerKW?: number; Level?: { Title: string } }[];
  OperatorInfo?: { Title: string };
}

export const GET = handleRoute(async (_ctx, req) => {
  const params = new URL(req.url).searchParams;
  const zip = (params.get("zip") ?? "").trim();
  if (!/^\d{5}$/.test(zip)) failWith(ErrorCodes.VALIDATION_FAILED);
  const radiusMi = Math.min(Math.max(Number.parseInt(params.get("radius_mi") ?? "10", 10) || 10, 1), 50);

  const apiKey = process.env.OPENCHARGEMAP_API_KEY;
  if (!apiKey) {
    return {
      status: "configuration_needed",
      message:
        "Charger locations need an OpenChargeMap API key (free tier). The integration is complete — only the credential is missing.",
    };
  }

  let point;
  try {
    point = await resolveZip(zip);
  } catch {
    throw new ApiError(ErrorCodes.NOT_FOUND);
  }

  const cacheKey = `chargers:${point.zip}:${radiusMi}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) return cached;

  try {
    const url =
      `https://api.openchargemap.io/v3/poi/?output=json&latitude=${point.lat}` +
      `&longitude=${point.lon}&distance=${radiusMi}&distanceunit=Miles&maxresults=25` +
      `&compact=true&verbose=false&key=${encodeURIComponent(apiKey)}`;
    const pois = await upstreamGet<OcmPoi[]>(url);
    const payload = {
      status: "ok",
      location: { zip: point.zip, city: point.city, state: point.state },
      radius_mi: radiusMi,
      chargers: (pois ?? []).map((p) => ({
        id: p.ID,
        name: p.AddressInfo?.Title ?? "Charging station",
        address: [p.AddressInfo?.AddressLine1, p.AddressInfo?.Town, p.AddressInfo?.StateOrProvince]
          .filter(Boolean)
          .join(", "),
        operator: p.OperatorInfo?.Title ?? null,
        connectors: (p.Connections ?? []).map((c) => ({
          type: c.ConnectionType?.Title ?? "Unknown",
          power_kw: c.PowerKW ?? null,
          level: c.Level?.Title ?? null,
        })),
      })),
      source: "OpenChargeMap (openchargemap.org)",
    };
    cacheSet(cacheKey, payload, 24 * 60 * 60 * 1000); // contract TTL: 24h
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(ErrorCodes.UPSTREAM_UNAVAILABLE);
  }
});
