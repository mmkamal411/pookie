// W30 Flights (REDESIGNED) — rules + visibility + alerts, never teen
// self-booking. Purchaser-of-record 18+ is a server-side invariant
// (FR-TRAVEL-001); the UI never presents a working checkout to a teen.
//
// Teen (deep link): Nebula-neutral "Booking needs a parent" panel with a
// plan-only trip idea + "Share this trip idea with a parent" CTA.
// Adult: trip planner (destination weather via real NWS), UM-rules catalog
// state (pending verification), and the purchaser gate result.

"use client";

import { useEffect, useState } from "react";
import { Button, Card, InfoLine } from "@/components/ui";
import { ErrorCard, LoadingRows, ZipGate, api, readStoredZip, storeZip } from "./travel-shared";

interface GateResult {
  allowed: boolean;
  reason_code?: string;
  message?: string;
  requires_adult?: boolean;
  planning_mode_only?: boolean;
}

export function FlightsPanel({ isTeen }: { isTeen: boolean }) {
  const [zip, setZip] = useState("");
  const [gate, setGate] = useState<GateResult | null>(null);
  const [tripName, setTripName] = useState("");
  const [destZip, setDestZip] = useState("");
  const [destWx, setDestWx] = useState<{ city: string; forecast: { name: string; temperature_f: number; short_forecast: string }[] } | null>(null);
  const [wxState, setWxState] = useState<"idle" | "loading" | "loaded" | "error">("idle");

  useEffect(() => {
    setZip(readStoredZip());
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<GateResult>("/api/v1/travel/purchase/check", {
      method: "POST",
      body: JSON.stringify({ flow: "flight" }),
    })
      .then((g) => {
        if (!cancelled) setGate(g);
      })
      .catch(() => {
        if (!cancelled) setGate(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const planTrip = () => {
    if (!/^\d{5}$/.test(destZip.trim())) return;
    setWxState("loading");
    api<{ location: { city: string; state: string }; forecast: { name: string; temperature_f: number; short_forecast: string }[] }>(
      `/api/v1/travel/weather?zip=${destZip.trim()}`,
    )
      .then((d) => {
        setDestWx({ city: `${d.location.city}, ${d.location.state}`, forecast: d.forecast.slice(0, 6) });
        setWxState("loaded");
      })
      .catch(() => setWxState("error"));
  };

  const shareTripIdea = () => {
    const text =
      `Trip idea: ${tripName.trim() || "Somewhere amazing"}` +
      (destZip.trim() ? ` (near ${destZip.trim()})` : "") +
      " — can we plan this together?";
    void navigator.clipboard?.writeText(text).catch(() => {});
  };

  if (isTeen) {
    // §1.2 deep-link rule: server rejects booking; UI shows the neutral sheet.
    return (
      <div className="space-y-4">
        <Card padding="lg" className="border-nova-400/20 bg-nebula-900/70">
          <p className="text-base font-semibold text-star-100">✈️ Flights need a grown-up to book.</p>
          <p className="mt-2 text-sm leading-relaxed text-stardust-300">
            Airlines require the person paying to be 18 or older — that&apos;s their rule, and
            Pookie enforces it. You can plan and dream all you want; a parent books it.
          </p>
          <div className="mt-4">
            <label htmlFor="trip-idea" className="block text-sm font-medium text-star-100">
              Name a dream trip
            </label>
            <input
              id="trip-idea"
              placeholder="e.g. See the Grand Canyon"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
            />
          </div>
          <div className="mt-3">
            <Button onClick={shareTripIdea} disabled={!tripName.trim()}>
              Share this trip idea with a parent
            </Button>
          </div>
          <p className="mt-2 text-xs text-stardust-500">
            Plan-only for now — prices are estimates, and a parent completes the booking.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <InfoLine tone="teal" icon="✈️">
        <strong>Purchaser of record must be 18+.</strong> Pookie enforces this server-side —
        no flight purchase can complete from a teen account, ever.
        {gate && !gate.allowed ? ` Gate check: ${gate.message}` : ""}
      </InfoLine>

      <ZipGate
        value={zip}
        label="Where are you flying from?"
        onChange={(z) => {
          setZip(z);
          storeZip(z);
        }}
      />

      <Card>
        <p className="text-sm font-semibold text-star-100">Plan a trip</p>
        <p className="mt-0.5 text-xs text-stardust-400">
          Destination weather, powered by the National Weather Service — real data for real plans.
        </p>
        <div className="mt-3 space-y-2">
          <input
            aria-label="Trip name"
            placeholder="Trip name (e.g. Grandma's in July)"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            className="w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              aria-label="Destination ZIP"
              inputMode="numeric"
              placeholder="Destination ZIP"
              value={destZip}
              onChange={(e) => setDestZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className="w-40 rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
            />
            <Button size="sm" disabled={!/^\d{5}$/.test(destZip.trim())} onClick={planTrip}>
              Check destination
            </Button>
          </div>
        </div>

        {wxState === "loading" && <div className="mt-3"><LoadingRows rows={2} /></div>}
        {wxState === "error" && (
          <div className="mt-3">
            <ErrorCard message="Couldn't pull the destination forecast just now." onRetry={planTrip} />
          </div>
        )}
        {wxState === "loaded" && destWx && (
          <div className="mt-3 rounded-xl border border-nova-400/15 bg-nebula-950/50 p-3">
            <p className="text-sm font-medium text-star-100">
              {tripName.trim() || "Your trip"} · {destWx.city}
            </p>
            <div className="mt-2 space-y-1">
              {destWx.forecast.map((f, i) => (
                <p key={i} className="text-[13px] text-stardust-300">
                  <span className="font-medium text-star-100">{f.name}:</span> {f.temperature_f}°F,{" "}
                  {f.short_forecast.toLowerCase()}
                </p>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <p className="text-sm font-semibold text-star-100">Airline rules for young travelers</p>
        <p className="mt-1 text-[13px] leading-relaxed text-stardust-300">
          Unaccompanied-minor age bands, fees, and phone-booking rules differ by airline and change
          without notice. The verified airline rulebook is still being compiled against published
          airline policies — until it lands, confirm directly with the airline before booking a
          teen&apos;s ticket.
        </p>
        <InfoLine className="mt-3" icon="📋">
          When the catalog lands, every rule shows its airline source and verification date
          (BACKLOG R-007). Pookie never guesses at airline policy.
        </InfoLine>
      </Card>
    </div>
  );
}
