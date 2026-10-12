// GET /api/v1/travel/trails?zip=&radius_mi= — W29 Trails & Parks.
//
// Real data: NPS API (developer.nps.gov, NPS_API_KEY free at api.data.gov;
// DEMO_KEY fallback with honest rate-limit note) for parks near the ZIP
// centroid (D7 coarse location). Squad 1's `trails`/`trail_safety_guidance`
// tables + rpc_get_trails are PENDING — supervision guidance carries an
// honest "guidance catalog pending" flag; the fixed safety block is built
// from the official NPS record + computed sunset (real solar math).
// Includes the NWS alert cross-check URL inputs for the panel.

import { handleRoute } from "@/server/rest";
import { ApiError, ErrorCodes, failWith } from "@/server/errors";
import { cacheGet, cacheSet, resolveZip, upstreamGet } from "@/lib/travel/upstream";
import { minutesToClock, sunTimes } from "@/lib/travel/solar";

interface NpsResponse {
  data: {
    id: string;
    fullName: string;
    parkCode: string;
    description: string;
    url: string;
    designation: string;
    states: string;
    addresses: { city: string; stateCode: string; type: string }[];
  }[];
}

export const GET = handleRoute(async (_ctx, req) => {
  const params = new URL(req.url).searchParams;
  const zip = (params.get("zip") ?? "").trim();
  if (!/^\d{5}$/.test(zip)) failWith(ErrorCodes.VALIDATION_FAILED);
  const radiusMi = Math.min(Math.max(Number.parseInt(params.get("radius_mi") ?? "50", 10) || 50, 5), 150);

  let point;
  try {
    point = await resolveZip(zip);
  } catch {
    throw new ApiError(ErrorCodes.NOT_FOUND);
  }

  const cacheKey = `trails:${point.zip}:${radiusMi}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.NPS_API_KEY ?? "DEMO_KEY";
  const today = new Date();
  const sun = sunTimes(point.lat, point.lon, today);

  try {
    // NPS parks endpoint supports a latLong + radius search.
    const url =
      `https://developer.nps.gov/api/v1/parks?` +
      `latLong=${point.lat},${point.lon}&radius=${radiusMi}&limit=20&api_key=${encodeURIComponent(apiKey)}`;
    const json = await upstreamGet<NpsResponse>(url);
    const parks = (json.data ?? []).map((p) => {
      const addr = (p.addresses ?? []).find((a) => a.type === "Physical") ?? p.addresses?.[0];
      return {
        id: p.id,
        name: p.fullName,
        park_code: p.parkCode,
        designation: p.designation,
        description: p.description,
        official_url: p.url,
        city: addr?.city ?? null,
        state: addr?.stateCode ?? p.states,
        // Fixed safety-block inputs (UX-SPECS §7 / BACKLOG S5-010 AC2):
        // official source + updated date always present; difficulty and
        // group-size guidance come from the park authority / guidance catalog.
        safety_block: {
          source: "National Park Service (nps.gov)",
          official_page: p.url,
          guidance_catalog: "pending" as const,
          guidance_note:
            "Difficulty and supervision guidance come from the official trail-safety catalog, which is still being connected. Check the park's official page for trail conditions before you go.",
        },
      };
    });
    const payload = {
      status: "ok",
      location: { zip: point.zip, city: point.city, state: point.state },
      radius_mi: radiusMi,
      sunset_today: sun ? minutesToClock(sun.sunset) : null,
      sunset_warning_minutes: 90,
      parks,
      nws_alert_check: `https://api.weather.gov/alerts/active?point=${point.lat.toFixed(4)},${point.lon.toFixed(4)}`,
      source: "National Park Service API (developer.nps.gov)",
      demo_key: apiKey === "DEMO_KEY",
    };
    cacheSet(cacheKey, payload, 7 * 24 * 60 * 60 * 1000); // contract TTL: 7d
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(ErrorCodes.UPSTREAM_UNAVAILABLE);
  }
});
