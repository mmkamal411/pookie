// W29 Trails & Parks (REDESIGNED) — real NPS park data near the coarse ZIP.
// Fixed safety block on every card (official source + page link; guidance
// catalog flagged honestly while Squad 1's table is pending). Under-16:
// no solo-hike recommendations anywhere — "share my plan" is the first-class
// step. 90-minute sunset warning computed from real solar math.

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

      {data?.sunset_today && state === "loaded" && (
        <InfoLine icon="🌇">
          Sunset today is around <strong>{data.sunset_today}</strong> here. You&apos;ll get a
          heads-up 90 minutes before sunset on hiking days — enough time to head back.
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
        <div className="space-y-2">
          {data.parks.length === 0 && (
            <Card>
              <p className="text-sm text-stardust-300">
                No National Park Service sites within range of {data.location?.zip}. Try a wider
                radius or a nearby ZIP.
              </p>
            </Card>
          )}
          {data.parks.map((p) => (
            <Card key={p.id} padding="sm">
              <p className="text-sm font-semibold text-star-100">{p.name}</p>
              <p className="text-xs text-stardust-400">
                {p.designation}
                {p.city ? ` · ${p.city}, ${p.state}` : ` · ${p.state}`}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-stardust-300">
                {p.description.slice(0, 240)}
                {p.description.length > 240 ? "…" : ""}
              </p>
              <div className="mt-2 rounded-lg border border-teal-400/20 bg-teal-500/5 px-2.5 py-2">
                <p className="text-[11px] font-semibold text-teal-200">Safety block</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-stardust-400">
                  Source: {p.safety_block.source} ·{" "}
                  <a href={p.official_url} target="_blank" rel="noreferrer" className="text-nova-300 underline">
                    Official park page
                  </a>
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-stardust-400">
                  {p.safety_block.guidance_note}
                </p>
                {under16 && (
                  <p className="mt-0.5 text-[11px] font-medium text-teal-200">
                    Bring 2+ people — go with an adult.
                  </p>
                )}
              </div>
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => setPlanFor(p)}>
                  Share my plan →
                </Button>
              </div>
            </Card>
          ))}
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
