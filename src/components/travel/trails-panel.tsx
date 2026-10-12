// W29 Trails & Parks — expeditions into the wild.
// Real NPS park data near the coarse ZIP. Fixed safety block on every card
// (official source + page link; guidance catalog flagged honestly while
// Squad 1's table is pending). Under-16: no solo-hike recommendations
// anywhere — "share my plan" is the first-class step. 90-minute sunset
// warning computed from real solar math.

"use client";

import { useEffect, useState } from "react";
import { Button, Card, InfoLine, Sheet } from "@/components/ui";
import {
  ErrorCard,
  InitializingCard,
  LoadingRows,
  ZipGate,
  api,
  readStoredZip,
  storeZip,
} from "./travel-shared";

interface Park {
  id: string;
  name: string;
  park_code: string;
  designation: string;
  description: string;
  official_url: string;
  city: string | null;
  state: string;
  safety_block: { source: string; official_page: string; guidance_note: string };
}
interface TrailsData {
  status: string;
  parks: Park[];
  sunset_today: string | null;
  sunset_warning_minutes: number;
  location?: { city: string; state: string; zip: string };
}

/** Expedition art per park designation — gradient skies for the wild. */
function artFor(designation: string): { sky: string; glyph: string; label: string } {
  const d = designation.toLowerCase();
  if (d.includes("national park"))
    return {
      sky: "linear-gradient(160deg, rgb(30 58 95 / 0.9), rgb(14 42 32 / 0.95))",
      glyph: "🏔️",
      label: "National Park",
    };
  if (d.includes("monument"))
    return {
      sky: "linear-gradient(160deg, rgb(88 60 28 / 0.9), rgb(48 30 18 / 0.95))",
      glyph: "🗿",
      label: "National Monument",
    };
  if (d.includes("historic"))
    return {
      sky: "linear-gradient(160deg, rgb(52 64 96 / 0.9), rgb(26 34 56 / 0.95))",
      glyph: "🏛️",
      label: "Historic Site",
    };
  if (d.includes("seashore") || d.includes("lakeshore") || d.includes("river"))
    return {
      sky: "linear-gradient(160deg, rgb(24 72 96 / 0.9), rgb(12 38 58 / 0.95))",
      glyph: "🌊",
      label: "Waterside",
    };
  if (d.includes("trail"))
    return {
      sky: "linear-gradient(160deg, rgb(34 78 52 / 0.9), rgb(16 44 30 / 0.95))",
      glyph: "🥾",
      label: "Trail",
    };
  return {
    sky: "linear-gradient(160deg, rgb(40 60 44 / 0.9), rgb(18 34 26 / 0.95))",
    glyph: "🌲",
    label: "Protected Land",
  };
}

export function TrailsPanel({ childAge, isTeen }: { childAge: number | null; isTeen: boolean }) {
  const [zip, setZip] = useState("");
  const [data, setData] = useState<TrailsData | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [wxAlerts, setWxAlerts] = useState(0);
  const [planFor, setPlanFor] = useState<Park | null>(null);
  const [trustedAdult, setTrustedAdult] = useState("");

  const under16 = childAge != null && childAge < 16;

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
    Promise.all([
      api<TrailsData>(`/api/v1/travel/trails?zip=${zip}`),
      api<{ alerts: unknown[] }>(`/api/v1/travel/weather?zip=${zip}`).catch(() => ({ alerts: [] })),
    ])
      .then(([trails, wx]) => {
        if (cancelled) return;
        setData(trails);
        setWxAlerts((wx.alerts ?? []).length);
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

  return (
    <div className="space-y-4">
      {/* Expedition header with sunset telemetry */}
      <section className="holo-panel led-strip-teal px-5 py-5">
        <p className="text-[10px] font-bold tracking-[0.2em] text-teal-200/70 uppercase">
          Expeditions
        </p>
        <h2 className="mt-1 text-xl font-bold text-star-100">Into the wild</h2>
        <p className="mt-0.5 text-sm text-stardust-300">
          Real National Park Service sites near you — with the safety briefing on every card.
        </p>
        {data?.sunset_today && state === "loaded" && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-3.5 py-1.5">
            <span aria-hidden="true">🌇</span>
            <span className="text-xs font-semibold text-amber-200">
              Sunset {data.sunset_today} — head back {data.sunset_warning_minutes} min before
            </span>
          </div>
        )}
      </section>

      {(under16 || isTeen) && (
        <InfoLine tone="teal" icon="🥾">
          <strong>Hiking is better with company.</strong>{" "}
          {under16
            ? "Under 16, Pookie only suggests hikes with others along — every trail here shows who should come with you."
            : "Every trail here shows who should come along. Share your plan before you head out."}
        </InfoLine>
      )}

      <ZipGate
        value={zip}
        label="What area should we explore?"
        onChange={(z) => {
          setZip(z);
          storeZip(z);
        }}
      />

      {wxAlerts > 0 && state === "loaded" && (
        <InfoLine tone="amber" icon="⛈️">
          The National Weather Service has {wxAlerts} active alert
          {wxAlerts === 1 ? "" : "s"} for this area. Check the official alert before heading out —
          Pookie suppresses trail suggestions during severe weather.
        </InfoLine>
      )}

      {state === "idle" && (
        <InitializingCard
          title="Add your ZIP for trails"
          message="Real parks from the National Park Service — with the safety block on every card, never a guess."
        />
      )}
      {state === "loading" && <LoadingRows rows={4} />}
      {state === "error" && <ErrorCard message={error} onRetry={() => setNonce((n) => n + 1)} />}

      {state === "loaded" && data && (
        <div className="space-y-4">
          {data.parks.length === 0 && (
            <Card>
              <p className="text-sm text-stardust-300">
                No National Park Service sites within range of {data.location?.zip}. Try a wider
                radius or a nearby ZIP.
              </p>
            </Card>
          )}
          {data.parks.map((p, i) => {
            const art = artFor(p.designation);
            return (
              <article
                key={p.id}
                className="card-living animate-rise group overflow-hidden rounded-3xl"
                style={{ animationDelay: `${Math.min(i, 8) * 0.06}s` }}
              >
                {/* Expedition banner */}
                <div
                  className="relative px-5 pb-4 pt-5"
                  style={{ background: art.sky }}
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(ellipse 80% 60% at 80% 0%, rgb(255 255 255 / 0.08), transparent 60%)",
                    }}
                    aria-hidden="true"
                  />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white/90 uppercase">
                        <span aria-hidden="true">{art.glyph}</span> {art.label}
                      </span>
                      <h3 className="mt-2 text-lg font-bold leading-tight text-white">
                        {p.name}
                      </h3>
                      <p className="mt-0.5 text-xs font-medium text-white/70">
                        {p.city ? `${p.city}, ${p.state}` : p.state}
                      </p>
                    </div>
                    <span className="text-4xl opacity-90 transition-transform group-hover:scale-125" aria-hidden="true">
                      {art.glyph}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 py-4">
                  <p className="text-[13px] leading-relaxed text-stardust-300">
                    {p.description.slice(0, 240)}
                    {p.description.length > 240 ? "…" : ""}
                  </p>

                  {/* Safety briefing — holographic panel */}
                  <div className="holo-panel mt-3 px-3.5 py-3">
                    <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-200/80 uppercase">
                      Safety Briefing
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-stardust-300">
                      Source: {p.safety_block.source} ·{" "}
                      <a href={p.official_url} target="_blank" rel="noreferrer" className="font-semibold text-cyan-300 underline underline-offset-2">
                        Official park page
                      </a>
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-stardust-400">
                      {p.safety_block.guidance_note}
                    </p>
                    {under16 && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-teal-400/15 px-2.5 py-1 text-[11px] font-bold text-teal-200">
                        <span aria-hidden="true">👥</span> Bring 2+ people — go with an adult
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setPlanFor(p)}>
                      Share my expedition plan →
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
          <p className="text-[11px] text-stardust-500">Source: National Park Service</p>
        </div>
      )}

      <Sheet
        open={planFor !== null}
        onClose={() => setPlanFor(null)}
        title="Share my plan"
        subtitle="One tap before you head out."
      >
        {planFor && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-star-100">{planFor.name}</p>
            <InfoLine>
              Before you head out, Pookie shares where you&apos;re going and when you&apos;ll be
              back. One tap, every time.
            </InfoLine>
            <div>
              <label htmlFor="trusted-adult" className="block text-sm font-medium text-star-100">
                Who gets your hiking plan?
              </label>
              <input
                id="trusted-adult"
                placeholder="e.g. Mom, Dad, Coach Rivera"
                value={trustedAdult}
                onChange={(e) => setTrustedAdult(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
              />
            </div>
            <Button
              disabled={!trustedAdult.trim()}
              onClick={() => {
                const text =
                  `My hiking plan: ${planFor.name} (${planFor.official_url}). ` +
                  `I'll share my return time before I go.`;
                void navigator.clipboard?.writeText(text).catch(() => {});
                setPlanFor(null);
              }}
            >
              Copy plan for {trustedAdult.trim() || "my trusted adult"}
            </Button>
            <p className="text-xs text-stardust-500">
              Full share-my-plan (check-in timers, overdue nudges) arrives with Squad 1&apos;s
              outing plans — this sheet marks the integration point.
            </p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
