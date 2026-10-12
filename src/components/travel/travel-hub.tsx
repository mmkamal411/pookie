// Travel hub — the 7 travel modules as real working cards.
// Each card carries a live data state (checking / live / needs-location /
// unavailable / needs-setup). Age gating mirrors modules.ts + menu-access:
// W30/W31 carry hideForTeen + minAge 18 — hidden for teen viewers entirely
// (hidden, never locked — sol-ux §9). Server routes enforce the same gates.

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, InfoLine } from "@/components/ui";
import { GROVES } from "@/lib/modules";
import { isTeenViewer, resolveModuleVisibility } from "@/lib/menu-access";
import { useViewerProfile } from "@/lib/use-viewer-profile";
import { ZipGate, api, readStoredZip, storeZip } from "./travel-shared";

const ICONS: Record<string, string> = {
  W25: "⛽",
  W30: "✈️",
  W31: "🚗",
  W27: "🎭",
  W28: "🍽️",
  W29: "🥾",
  W26: "🌤️",
};

type CardState =
  | { kind: "checking" }
  | { kind: "live"; line: string }
  | { kind: "needs-location" }
  | { kind: "needs-setup"; line: string }
  | { kind: "connecting"; line: string }
  | { kind: "unavailable"; line: string };

async function fetchState(id: string, zip: string): Promise<CardState> {
  if (!zip) return { kind: "needs-location" };
  try {
    switch (id) {
      case "W26": {
        const d = await api<{ forecast: { temperature_f: number; short_forecast: string }[]; alerts: unknown[] }>(
          `/api/v1/travel/weather?zip=${zip}`,
        );
        const now = d.forecast[0];
        const alertBit = d.alerts.length > 0 ? ` · ${d.alerts.length} alert${d.alerts.length === 1 ? "" : "s"}` : "";
        return now
          ? { kind: "live", line: `${now.temperature_f}°F, ${now.short_forecast.toLowerCase()}${alertBit}` }
          : { kind: "unavailable", line: "No forecast right now." };
      }
      case "W25": {
        const d = await api<{ status: string; price_per_gallon?: number; message?: string }>(
          `/api/v1/travel/fuel?zip=${zip}&fuel_type=gas`,
        );
        if (d.status === "configuration_needed")
          return { kind: "needs-setup", line: "Fuel prices need a free EIA key." };
        return { kind: "live", line: `$${d.price_per_gallon?.toFixed(2)}/gal (regional average)` };
      }
      case "W27": {
        const d = await api<{ status: string; events: unknown[]; message?: string }>(
          `/api/v1/travel/events?zip=${zip}`,
        );
        if (d.status === "service_initializing")
          return { kind: "connecting", line: "Event catalog connecting…" };
        const n = d.events.length;
        return n > 0
          ? { kind: "live", line: `${n} vetted event${n === 1 ? "" : "s"} nearby` }
          : { kind: "live", line: "No vetted events nearby right now." };
      }
      case "W28": {
        const d = await api<{ status: string; restaurants: unknown[] }>(
          `/api/v1/travel/restaurants?zip=${zip}`,
        );
        if (d.status === "configuration_needed")
          return { kind: "needs-setup", line: "Listings need a free Foursquare key." };
        const n = d.restaurants.length;
        return { kind: "live", line: `${n} real place${n === 1 ? "" : "s"} nearby` };
      }
      case "W29": {
        const d = await api<{ status: string; parks: unknown[] }>(
          `/api/v1/travel/trails?zip=${zip}`,
        );
        const n = d.parks.length;
        return n > 0
          ? { kind: "live", line: `${n} park${n === 1 ? "" : "s"} within range` }
          : { kind: "live", line: "No parks in range — try a wider radius." };
      }
      default:
        return { kind: "needs-location" };
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "UPSTREAM_UNAVAILABLE") return { kind: "unavailable", line: "The source is down right now." };
    return { kind: "unavailable", line: "Couldn't reach that just now." };
  }
}

function StateLine({ state }: { state: CardState }) {
  switch (state.kind) {
    case "checking":
      return <span className="text-stardust-500">Checking…</span>;
    case "live":
      return (
        <span className="text-emerald-300">
          <span aria-hidden="true">● </span>
          {state.line}
        </span>
      );
    case "needs-location":
      return <span className="text-stardust-400">Add your ZIP above for live info.</span>;
    case "needs-setup":
      return <span className="text-amber-200/90">{state.line}</span>;
    case "connecting":
      return <span className="text-stardust-300">{state.line}</span>;
    case "unavailable":
      return <span className="text-stardust-400">{state.line}</span>;
  }
}

export function TravelHub({ childSlug }: { childSlug: string }) {
  const viewer = useViewerProfile();
  const [zip, setZip] = useState("");
  const [states, setStates] = useState<Record<string, CardState>>({});

  const modules = useMemo(() => {
    const grove = GROVES.find((g) => g.name === "Travel");
    return (grove?.modules ?? []).filter((m) => resolveModuleVisibility(m, viewer) === "visible");
  }, [viewer]);

  useEffect(() => {
    setZip(readStoredZip());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ids = modules.map((m) => m.id).filter((id) => !["W30", "W31"].includes(id));
    setStates(Object.fromEntries(ids.map((id) => [id, { kind: "checking" as const }])));
    Promise.all(ids.map((id) => fetchState(id, zip))).then((results) => {
      if (cancelled) return;
      setStates(Object.fromEntries(ids.map((id, i) => [id, results[i]])));
    });
    return () => {
      cancelled = true;
    };
  }, [zip, modules]);

  const teen = isTeenViewer(viewer);

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-3xl">
          🌍
        </span>
        <div>
          <h1 className="text-xl font-semibold text-star-100">Travel</h1>
          <p className="text-sm text-stardust-300">getting around, and the world beyond the door</p>
        </div>
      </div>

      <div className="mt-4">
        <InfoLine>
          Some travel tools unlock as you grow up — Pookie grows with you.
        </InfoLine>
      </div>

      <div className="mt-4">
        <ZipGate
          value={zip}
          onChange={(z) => {
            setZip(z);
            storeZip(z);
          }}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {modules.map((m) => {
          const state: CardState =
            m.id === "W30"
              ? teen
                ? { kind: "connecting", line: "" }
                : { kind: "live", line: "Plan trips — a grown-up books." }
              : m.id === "W31"
                ? { kind: "live", line: "Real totals, 21+ company rules." }
                : (states[m.id] ?? { kind: "checking" as const });
          return (
            <Link key={m.id} href={`/c/${childSlug}${m.route ?? "/travel"}`} className="block">
              <Card className="flex h-full items-start gap-3 transition-transform hover:-translate-y-0.5">
                <span aria-hidden="true" className="text-2xl">
                  {ICONS[m.id] ?? "🧭"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-star-100">{m.name}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-stardust-300">
                    {m.watchOver}
                  </span>
                  <span className="mt-1.5 block text-xs">
                    <StateLine state={state} />
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-nova-300">
                  ›
                </span>
              </Card>
            </Link>
          );
        })}
      </div>

      {modules.length === 0 && (
        <div className="mt-5">
          <Card>
            <p className="text-sm text-stardust-300">
              Nothing here for you right now. Some parts of Pookie unlock as you get older. Pookie
              grows with you.
            </p>
          </Card>
        </div>
      )}
    </main>
  );
}
