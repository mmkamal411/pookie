"use client";

import { useEffect, useState } from "react";
import { PanelShell, PanelNote } from "./panel-shell";
import type { HouseholdWeather } from "@/server/services/weather";

const CONDITION_GLYPH: Record<string, string> = {
  clear: "☀️",
  partly: "⛅",
  cloudy: "☁️",
  rain: "🌧️",
  storm: "⛈️",
  snow: "❄️",
  fog: "🌫️",
  wind: "💨",
};

type WeatherPayload = HouseholdWeather & {
  defaulted?: boolean;
  not_emergency_system?: boolean;
};

/**
 * WeatherPanel — the sky over the pilot's day, in a glass pane.
 * Account-level (owner-anchored coarse ZIP, never precise location).
 * Data: GET /api/v1/household/weather (NWS primary, Open-Meteo fallback).
 */
export function WeatherPanel({ highlighted, bare }: { highlighted?: boolean; bare?: boolean }) {
  const [wx, setWx] = useState<WeatherPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/v1/household/weather")
      .then((r) => r.json())
      .then((j) => {
        if (!live) return;
        if (j.ok) setWx(j.data as WeatherPayload);
        else setFailed(true);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const current = wx?.current;
  const days = (wx?.days ?? []).slice(0, 5);

  return (
    <PanelShell bare={bare} eyebrow="Atmo" title="Weather" highlighted={highlighted}>
      {failed || !wx ? (
        <PanelNote>
          {failed
            ? "The sky feed is quiet right now — check back in a bit."
            : "Reading the sky…"}
        </PanelNote>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <span aria-hidden="true" className="text-4xl">
              {CONDITION_GLYPH[current?.condition ?? "partly"] ?? "⛅"}
            </span>
            <div>
              <p className="text-sunlit text-3xl font-semibold">
                {current ? `${Math.round(current.tempF)}°` : "—"}
              </p>
              <p className="mt-0.5 text-xs text-stardust-300">
                {current?.shortForecast ?? ""}
                {wx.location?.city ? ` · ${wx.location.city}` : ""}
              </p>
            </div>
            {days[0] && (
              <p className="ml-auto text-right text-xs leading-relaxed text-stardust-300">
                H {Math.round(days[0].highF)}° · L {Math.round(days[0].lowF)}°
                <br />
                {days[0].precipChance > 0 ? `${days[0].precipChance}% rain` : "Dry"}
              </p>
            )}
          </div>
          {days.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {days.slice(1, 5).map((d) => (
                <div
                  key={d.date}
                  className="rounded-2xl border border-white/5 bg-white/[0.03] px-2 py-2.5 text-center"
                >
                  <p className="text-[10px] font-medium tracking-wider text-stardust-400 uppercase">
                    {d.weekday.slice(0, 3)}
                  </p>
                  <p aria-hidden="true" className="mt-1 text-lg">
                    {CONDITION_GLYPH[d.condition] ?? "⛅"}
                  </p>
                  <p className="mt-1 text-[11px] text-stardust-200">
                    {Math.round(d.highF)}° <span className="text-stardust-500">{Math.round(d.lowF)}°</span>
                  </p>
                </div>
              ))}
            </div>
          )}
          {wx.alerts && wx.alerts.length > 0 && (
            <p className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
              {wx.alerts[0].headline}
            </p>
          )}
        </>
      )}
    </PanelShell>
  );
}
