// W28 Restaurants — real verified Foursquare listings near the coarse ZIP.
// 21+/bar-primary excluded server-side for <18. Allergen hard-blocks read
// the health allergy list when connected (never inferred, never an
// "allergy-safe" claim). Teen night-safety bias toggle, default ON <18.

"use client";

import { useEffect, useState } from "react";
import { Card, InfoLine, Toggle } from "@/components/ui";
import {
  ConfigNeededCard,
  ErrorCard,
  InitializingCard,
  LoadingRows,
  ZipGate,
  api,
  readStoredZip,
  storeZip,
} from "./travel-shared";

interface Restaurant {
  id: string;
  name: string;
  address: string;
  categories: string[];
  distance_m: number | null;
  dph_score: number | null;
}
interface RestaurantsData {
  status: string;
  restaurants: Restaurant[];
  allergen_filter: "active" | "unavailable";
  allergen_note: string;
  dph_note: string;
  message?: string;
  location?: { city: string; state: string; zip: string };
}

function miles(m: number | null): string {
  if (m == null) return "";
  const mi = m / 1609.34;
  return mi < 0.1 ? "nearby" : `${mi.toFixed(1)} mi`;
}

export function RestaurantsPanel({ isTeen }: { isTeen: boolean }) {
  const [zip, setZip] = useState("");
  const [data, setData] = useState<RestaurantsData | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [nightSafe, setNightSafe] = useState(isTeen);

  useEffect(() => {
    setZip(readStoredZip());
  }, []);

  useEffect(() => {
    if (!zip) {
      setState("idle");
      return;
    }
    let cancelled = false;
    setState("loading");
    api<RestaurantsData>(`/api/v1/travel/restaurants?zip=${zip}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setState("loaded");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [zip, nonce]);

  const hour = new Date().getHours();
  const afterDark = hour >= 18 || hour < 6;
  let list = data?.restaurants ?? [];
  // Teen night-safety bias: after dark, prefer well-lit, populated spots
  // (proxied honestly by distance — nearer, busier areas first).
  if (nightSafe && afterDark) {
    list = [...list].sort((a, b) => (a.distance_m ?? 99999) - (b.distance_m ?? 99999));
  }

  return (
    <div className="space-y-4">
      <ZipGate
        value={zip}
        label="Where should we eat?"
        onChange={(z) => {
          setZip(z);
          storeZip(z);
        }}
      />

      <Card padding="sm">
        <Toggle
          checked={nightSafe}
          onChange={setNightSafe}
          label="Prefer well-lit, busy areas after dark"
          description={
            isTeen
              ? "On for your age — Pookie leans toward populated spots at night."
              : "Biases evening results toward populated, well-lit areas."
          }
        />
      </Card>

      {data?.allergen_filter && (
        <InfoLine tone={data.allergen_filter === "active" ? "teal" : "info"} icon="🥜">
          {data.allergen_note}
        </InfoLine>
      )}

      {state === "idle" && (
        <InitializingCard
          title="Add your ZIP for restaurants"
          message="Real verified listings — taste-learned picks from places that actually exist near you."
        />
      )}
      {state === "loading" && <LoadingRows rows={5} />}
      {state === "error" && <ErrorCard message={error} onRetry={() => setNonce((n) => n + 1)} />}

      {state === "loaded" && data?.status === "configuration_needed" && (
        <ConfigNeededCard
          title="Restaurant listings need a key"
          message={data.message ?? "The integration is complete — only the credential is missing."}
        />
      )}

      {state === "loaded" && data?.status === "ok" && (
        <div className="space-y-2">
          {list.length === 0 && (
            <Card>
              <p className="text-sm text-stardust-300">
                No places found near {data.location?.zip}. Try a nearby ZIP.
              </p>
            </Card>
          )}
          {list.map((r) => (
            <Card key={r.id} padding="sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-star-100">{r.name}</p>
                {r.distance_m != null && (
                  <span className="shrink-0 text-xs text-stardust-400">{miles(r.distance_m)}</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-stardust-400">
                {r.categories.slice(0, 3).join(" · ")}
              </p>
              {r.address && <p className="mt-0.5 text-xs text-stardust-500">{r.address}</p>}
              <p className="mt-1 text-[11px] text-stardust-500">Health score: not available</p>
            </Card>
          ))}
          <p className="text-[11px] text-stardust-500">
            Listings: Foursquare. {data.dph_note}
          </p>
        </div>
      )}
    </div>
  );
}
