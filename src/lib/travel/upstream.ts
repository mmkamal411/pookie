// Travel upstream helpers — coarse-location (ZIP) resolution + tiny
// process-local TTL cache for external reads.
//
// MD D7 (architectural constraint): coarse location ONLY. The only location
// input any Squad 5 travel code ever accepts is a user-typed ZIP (city-level).
// No precise GPS is requested, stored, or transmitted — there is no
// geolocation-permission code anywhere in this directory.
//
// The external_data_cache table (PENDING, Unit P5) will replace this
// process-local cache once the migration is applied; the TTLs below match
// the contract (§6.2).

interface CacheEntry {
  at: number;
  ttlMs: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();

export function cacheGet<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.at > e.ttlMs) {
    cache.delete(key);
    return null;
  }
  return e.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  cache.set(key, { at: Date.now(), ttlMs, value });
}

export interface ZipPoint {
  zip: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
}

/**
 * Resolve a US ZIP to a coarse lat/lon centroid (zippopotam.us — keyless).
 * Returns the ZIP centroid only: never a street address, never precise.
 */
export async function resolveZip(zip: string): Promise<ZipPoint> {
  const clean = zip.trim();
  if (!/^\d{5}$/.test(clean)) throw new Error("bad_zip");
  const cached = cacheGet<ZipPoint>(`zip:${clean}`);
  if (cached) return cached;
  const res = await fetch(`https://api.zippopotam.us/us/${clean}`, {
    headers: { "User-Agent": "Pookie/1.0 (support@pookie.app)" },
  });
  if (!res.ok) throw new Error("zip_not_found");
  const json = (await res.json()) as {
    places: { "place name": string; state: string; latitude: string; longitude: string }[];
  };
  const p = json.places?.[0];
  if (!p) throw new Error("zip_not_found");
  const point: ZipPoint = {
    zip: clean,
    city: p["place name"],
    state: p.state,
    lat: Number.parseFloat(p.latitude),
    lon: Number.parseFloat(p.longitude),
  };
  cacheSet(`zip:${clean}`, point, 7 * 24 * 60 * 60 * 1000);
  return point;
}

const NWS_UA = "Pookie/1.0 (support@pookie.app)";

/** GET with the NWS-mandated User-Agent; throws "upstream_unavailable" on failure. */
export async function nwsGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": NWS_UA, Accept: "application/geo+json" },
  });
  if (!res.ok) throw new Error("upstream_unavailable");
  return (await res.json()) as T;
}

/** Plain GET with a Pookie UA; throws "upstream_unavailable" on failure. */
export async function upstreamGet<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Pookie/1.0 (support@pookie.app)", ...headers },
  });
  if (!res.ok) throw new Error("upstream_unavailable");
  return (await res.json()) as T;
}
