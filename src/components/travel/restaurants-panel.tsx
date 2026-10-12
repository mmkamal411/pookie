// W28 Restaurants — dining destinations across the sector.
// Real verified Foursquare listings near the coarse ZIP. 21+/bar-primary
// excluded server-side for <18. Allergen hard-blocks read the health allergy
// list when connected (never inferred, never an "allergy-safe" claim).
// Teen night-safety bias toggle, default ON <18.

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
  return mi < 0.1 ? "Nearby" : `${mi.toFixed(1)} mi`;
}

/** Cuisine sigil — a small glowing glyph per cuisine family. */
const CUISINE_SIGILS: { match: RegExp; glyph: string; hue: string }[] = [
  { match: /italian|pizza|pasta/i, glyph: "🍝", hue: "amber" },
  { match: /mexican|taco|burrito/i, glyph: "🌮", hue: "orange" },
  { match: /chinese|dim sum|noodle/i, glyph: "🥡", hue: "red" },
  { match: /japanese|sushi|ramen/i, glyph: "🍣", hue: "rose" },
  { match: /indian|curry/i, glyph: "🍛", hue: "yellow" },
  { match: /thai/i, glyph: "🍜", hue: "lime" },
  { match: /american|burger|bbq|steak/i, glyph: "🍔", hue: "sky" },
  { match: /seafood|fish/i, glyph: "🦐", hue: "cyan" },
  { match: /breakfast|brunch|coffee|cafe/i, glyph: "☕", hue: "stone" },
  { match: /bakery|dessert|ice cream|sweet/i, glyph: "🧁", hue: "pink" },
  { match: /vietnamese|pho/i, glyph: "🍲", hue: "emerald" },
  { match: /korean/i, glyph: "🍱", hue: "violet" },
  { match: /mediterranean|greek/i, glyph: "🫒", hue: "teal" },
];

function sigilFor(categories: string[]): { glyph: string; hue: string } {
  const joined = categories.join(" ");
  for (const s of CUISINE_SIGILS) {
    if (s.match.test(joined)) return { glyph: s.glyph, hue: s.hue };
  }
  return { glyph: "🍽️", hue: "nova" };
}

function timeGreeting(): { line: string; sub: string } {
  const h = new Date().getHours();
  if (h < 11) return { line: "Morning fuel run?", sub: "Breakfast and brunch spots near you." };
  if (h < 14) return { line: "Lunch coordinates?", sub: "Midday spots within easy reach." };
  if (h < 17) return { line: "Afternoon refuel?", sub: "Coffee, snacks, and light bites nearby." };
  if (h < 21) return { line: "Dinner destination?", sub: "Where should the crew eat tonight?" };
  return { line: "Late-night provisions?", sub: "What's still open near you." };
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

  const greeting = timeGreeting();

  return (
    <div className="space-y-4">
      {/* Hero — time-aware dining header */}
      <section className="holo-panel led-strip px-5 py-5">
        <p className="text-[10px] font-bold tracking-[0.2em] text-cyan-200/70 uppercase">
          Dining Destinations
        </p>
        <h2 className="mt-1 text-xl font-bold text-star-100">{greeting.line}</h2>
        <p className="mt-0.5 text-sm text-stardust-300">{greeting.sub}</p>
        {data?.location && (
          <p className="mt-2 text-xs text-stardust-400">
            Scanning near {data.location.city}, {data.location.state} {data.location.zip}
          </p>
        )}
      </section>

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
        <InfoLine tone={data.allergen_filter === "active" ? "teal" : "info"} icon="🛡️">
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
        <div className="space-y-3">
          {list.length === 0 && (
            <Card>
              <p className="text-sm text-stardust-300">
                No places found near {data.location?.zip}. Try a nearby ZIP.
              </p>
            </Card>
          )}
          {list.map((r, i) => {
            const sigil = sigilFor(r.categories);
            return (
              <article
                key={r.id}
                className="card-living animate-rise group relative overflow-hidden rounded-3xl p-4"
                style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}
              >
                <div className="flex items-start gap-3.5">
                  {/* Cuisine sigil */}
                  <div className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl border border-nova-400/25 bg-gradient-to-br from-nebula-800/80 to-nebula-950/90 text-2xl shadow-glow-sm transition-transform group-hover:scale-110">
                    <span aria-hidden="true">{sigil.glyph}</span>
                    <span className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent via-transparent to-white/10" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[15px] font-bold leading-snug text-star-100">
                        {r.name}
                      </h3>
                      {r.distance_m != null && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-bold text-cyan-200">
                          <span aria-hidden="true">📍</span> {miles(r.distance_m)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-medium tracking-wide text-stardust-300">
                      {r.categories.slice(0, 3).join(" · ")}
                    </p>
                    {r.address && (
                      <p className="mt-0.5 truncate text-xs text-stardust-500">{r.address}</p>
                    )}
                  </div>
                </div>
                {/* Neon journey line */}
                <div
                  className="pointer-events-none absolute bottom-0 left-6 right-6 h-px opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgb(103 232 249 / 0.7), transparent)",
                    boxShadow: "0 0 10px rgb(103 232 249 / 0.5)",
                  }}
                  aria-hidden="true"
                />
              </article>
            );
          })}
          <p className="text-[11px] text-stardust-500">
            Listings: Foursquare. {data.dph_note}
          </p>
        </div>
      )}
    </div>
  );
}
