// W25 Fuel & Charging — real EIA regional-average fuel prices + real
// OpenChargeMap charger POIs near the coarse ZIP. The price card always
// says "regional average" honestly; station-level prices are a future
// vendor integration, never faked.

"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
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

interface FuelData {
  status: string;
  price_per_gallon?: number;
  period?: string;
  granularity_note?: string;
  source?: string;
  message?: string;
  location?: { city: string; state: string; zip: string };
}
interface Charger {
  id: number;
  name: string;
  address: string;
  operator: string | null;
  connectors: { type: string; power_kw: number | null; level: string | null }[];
}
interface ChargerData {
  status: string;
  chargers?: Charger[];
  message?: string;
  location?: { city: string; state: string; zip: string };
}

type Tab = "gas" | "ev";

export function FuelPanel() {
  const [zip, setZip] = useState("");
  const [tab, setTab] = useState<Tab>("gas");
  const [fuelType, setFuelType] = useState<"gas" | "diesel">("gas");
  const [fuel, setFuel] = useState<FuelData | null>(null);
  const [chargers, setChargers] = useState<ChargerData | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

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
    const path =
      tab === "gas"
        ? `/api/v1/travel/fuel?zip=${zip}&fuel_type=${fuelType}`
        : `/api/v1/travel/chargers?zip=${zip}`;
    api<FuelData | ChargerData>(path)
      .then((d) => {
        if (cancelled) return;
        if (tab === "gas") setFuel(d as FuelData);
        else setChargers(d as ChargerData);
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
  }, [zip, tab, fuelType, nonce]);

  const active = tab === "gas" ? fuel : chargers;

  return (
    <div className="space-y-4">
      <ZipGate
        value={zip}
        label="Where are you driving?"
        onChange={(z) => {
          setZip(z);
          storeZip(z);
        }}
      />

      <div className="flex gap-2" role="tablist" aria-label="Fuel or charging">
        {(["gas", "ev"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-nova-400/50 bg-nova-500/15 text-star-100"
                : "border-nova-400/15 bg-nebula-900/50 text-stardust-300"
            }`}
          >
            {t === "gas" ? "⛽ Gas prices" : "🔌 EV chargers"}
          </button>
        ))}
      </div>

      {tab === "gas" && (
        <div className="flex gap-2" aria-label="Fuel type">
          {(["gas", "diesel"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFuelType(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                fuelType === f
                  ? "border-nova-400/50 bg-nova-500/15 text-star-100"
                  : "border-nova-400/15 text-stardust-300"
              }`}
            >
              {f === "gas" ? "Regular gas" : "Diesel"}
            </button>
          ))}
        </div>
      )}

      {state === "idle" && (
        <InitializingCard
          title="Add your ZIP for fuel info"
          message="Real prices from the U.S. Energy Information Administration, and real charger locations from OpenChargeMap — for your area, not a guess."
        />
      )}
      {state === "loading" && <LoadingRows rows={3} />}
      {state === "error" && <ErrorCard message={error} onRetry={() => setNonce((n) => n + 1)} />}

      {state === "loaded" && active?.status === "configuration_needed" && (
        <ConfigNeededCard
          title={tab === "gas" ? "Fuel prices need a key" : "Charger map needs a key"}
          message={active.message ?? "The integration is complete — only the credential is missing."}
        />
      )}

      {state === "loaded" && tab === "gas" && fuel?.status === "ok" && (
        <Card padding="lg" className="text-center">
          <p className="text-xs text-stardust-400">
            {fuelType === "gas" ? "Regular gasoline" : "Diesel"} · {fuel.location?.city},{" "}
            {fuel.location?.state}
          </p>
          <p className="mt-2 text-4xl font-semibold text-star-100">
            ${fuel.price_per_gallon?.toFixed(2)}
            <span className="text-base font-normal text-stardust-300">/gal</span>
          </p>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-stardust-400">
            {fuel.granularity_note} Week of {fuel.period}.
          </p>
          <p className="mt-2 text-[11px] text-stardust-500">{fuel.source}</p>
        </Card>
      )}

      {state === "loaded" && tab === "ev" && chargers?.status === "ok" && (
        <div className="space-y-2">
          {chargers.chargers?.length === 0 && (
            <Card>
              <p className="text-sm text-stardust-300">
                No chargers found within 10 miles of {chargers.location?.zip}. Try a nearby ZIP.
              </p>
            </Card>
          )}
          {chargers.chargers?.map((c) => (
            <Card key={c.id} padding="sm">
              <p className="text-sm font-semibold text-star-100">{c.name}</p>
              <p className="text-xs text-stardust-400">{c.address}</p>
              <p className="mt-1 text-xs text-stardust-300">
                {(c.connectors ?? [])
                  .map((k) => `${k.type}${k.power_kw ? ` · ${k.power_kw} kW` : ""}`)
                  .join("  ·  ") || "Connector info not listed"}
                {c.operator ? `  ·  ${c.operator}` : ""}
              </p>
            </Card>
          ))}
          <p className="text-[11px] text-stardust-500">Source: OpenChargeMap</p>
        </div>
      )}
    </div>
  );
}
