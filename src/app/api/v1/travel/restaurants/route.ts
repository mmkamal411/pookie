// GET /api/v1/travel/restaurants?zip=&radius_mi= — W28 Restaurants.
//
// Listings: Foursquare Places API (Tech-Lead decision, BACKEND-CONTRACTS
// §6.2; FOURSQUARE_API_KEY free tier). Every listing is a real verified
// Foursquare place — never hallucinated. GA DPH inspection scores: shown
// as "not available" until the published feed is wired (never invented).
//
// Safety rules (server-side, never UI-only):
//  - 21+/bar-primary venues excluded for <18 (sol-ux §14)
//  - allergen hard-blocks read the health allergy list when the table
//    exists; when it doesn't (frozen migrations), the filter state is
//    reported honestly as "unavailable" — never silently skipped

import { handleRoute } from "@/server/rest";
import { ApiError, ErrorCodes, failWith } from "@/server/errors";
import { createClient } from "@/lib/supabase/server";
import { cacheGet, cacheSet, resolveZip, upstreamGet } from "@/lib/travel/upstream";

interface FsPlace {
  fsq_id: string;
  name: string;
  location: { address?: string; locality?: string; region?: string; postcode?: string };
  categories: { id: number; name: string }[];
  distance?: number;
}

// Foursquare category ids treated as bar/nightlife-primary (excluded <18).
const BAR_PRIMARY = new Set([13003, 13009, 13025, 13029, 13032, 13035, 13038, 13054, 13377, 13387]);

export const GET = handleRoute(async (_ctx, req) => {
  const params = new URL(req.url).searchParams;
  const zip = (params.get("zip") ?? "").trim();
  if (!/^\d{5}$/.test(zip)) failWith(ErrorCodes.VALIDATION_FAILED);
  const radiusMi = Math.min(Math.max(Number.parseInt(params.get("radius_mi") ?? "10", 10) || 10, 1), 25);

  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    return {
      status: "configuration_needed",
      message:
        "Restaurant listings need a Foursquare API key (free tier). The integration is complete — only the credential is missing.",
    };
  }

  let point;
  try {
    point = await resolveZip(zip);
  } catch {
    throw new ApiError(ErrorCodes.NOT_FOUND);
  }

  // Server-side age band: 21+/bar-primary excluded for <18.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let band = "child";
  try {
    if (user) {
      const { data } = await supabase.rpc("support_user_age_band", { p_user_id: user.id });
      if (typeof data === "string") band = data;
    }
  } catch {
    band = "child";
  }
  const isAdult = band === "adult";

  // Allergen hard-block list (never inferred). Missing table → honest flag.
  let allergies: string[] = [];
  let allergenFilter: "active" | "unavailable" = "unavailable";
  try {
    const { data, error } = await supabase.from("health_allergies").select("allergen");
    if (!error && data) {
      allergies = (data as { allergen: string }[]).map((r) => r.allergen.toLowerCase());
      allergenFilter = "active";
    }
  } catch {
    allergenFilter = "unavailable";
  }

  const cacheKey = `restaurants:${point.zip}:${radiusMi}:${isAdult ? "a" : "t"}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) return cached;

  try {
    const radiusM = Math.round(radiusMi * 1609.34);
    const url =
      `https://api.foursquare.com/v3/places/search?` +
      `ll=${point.lat},${point.lon}&radius=${radiusM}&limit=25&categories=13065&sort=DISTANCE`;
    const json = await upstreamGet<{ results: FsPlace[] }>(url, { Authorization: apiKey });
    let places = json.results ?? [];

    if (!isAdult) {
      places = places.filter(
        (p) => !(p.categories ?? []).some((c) => BAR_PRIMARY.has(c.id)),
      );
    }
    // Allergen hard-block: any place whose name/category text names a listed
    // allergen is removed outright (no "allergy-safe" claims anywhere).
    if (allergenFilter === "active" && allergies.length > 0) {
      places = places.filter((p) => {
        const hay = `${p.name} ${(p.categories ?? []).map((c) => c.name).join(" ")}`.toLowerCase();
        return !allergies.some((a) => a.length > 2 && hay.includes(a));
      });
    }

    const payload = {
      status: "ok",
      location: { zip: point.zip, city: point.city, state: point.state },
      radius_mi: radiusMi,
      allergen_filter: allergenFilter,
      allergen_note:
        allergenFilter === "active"
          ? "Listings naming your listed allergens are blocked outright."
          : "Allergy blocking is not connected yet — always tell the restaurant about allergies directly.",
      dph_scores: "not_available" as const,
      dph_note: "GA DPH inspection scores are not wired to a published feed yet — shown as not available, never invented.",
      restaurants: places.map((p) => ({
        id: p.fsq_id,
        name: p.name,
        address: [p.location.address, p.location.locality, p.location.region, p.location.postcode]
          .filter(Boolean)
          .join(", "),
        categories: (p.categories ?? []).map((c) => c.name),
        distance_m: p.distance ?? null,
        dph_score: null,
      })),
      source: "Foursquare Places (foursquare.com)",
    };
    cacheSet(cacheKey, payload, 6 * 60 * 60 * 1000); // contract TTL: 6h
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(ErrorCodes.UPSTREAM_UNAVAILABLE);
  }
});
