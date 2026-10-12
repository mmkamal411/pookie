"use client";

import { useEffect, useState } from "react";
import { WEATHER_FALLBACK, type WeatherDay, type WeatherIcon } from "@/lib/school/weather";
import { Collapsible } from "./collapsible";

function Icon({ icon }: { icon: WeatherIcon }) {
  const cls = "size-7";
  switch (icon) {
    case "sun": return <span className={cls} aria-hidden="true">☀️</span>;
    case "cloud-sun": return <span className={cls} aria-hidden="true">⛅</span>;
    case "cloud": return <span className={cls} aria-hidden="true">☁️</span>;
    case "rain": return <span className={cls} aria-hidden="true">🌧️</span>;
    case "storm": return <span className={cls} aria-hidden="true">⛈️</span>;
    case "snow": return <span className={cls} aria-hidden="true">❄️</span>;
    case "wind": return <span className={cls} aria-hidden="true">💨</span>;
  }
}

/** 5-day Marietta forecast — collapsed by default. Open-Meteo, live when reachable. */
export function WeatherCard({ childId }: { childId: string }) {
  const [days, setDays] = useState<WeatherDay[]>(WEATHER_FALLBACK);
  const [live, setLive] = useState(false);
  const today = days[0];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/children/${childId}/school/weather`);
        if (!res.ok) return;
        const json = (await res.json()) as { data: { days: WeatherDay[]; live: boolean } };
        if (!cancelled && json.data?.days?.length >= 5) {
          setDays(json.data.days.slice(0, 5));
          setLive(json.data.live);
        }
      } catch {
        // fallback snapshot holds — the card never blanks
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId]);

  return (
    <Collapsible
      title={`Weather — ${today.high}°/${today.low}° ${today.label} in Marietta`}
      subtitle={live ? "Live from Open-Meteo" : "Seasonal snapshot · will refresh when the forecast service is reachable"}
    >
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d, i) => (
          <div
            key={d.fullDate}
            className={`flex min-w-[88px] flex-1 flex-col items-center gap-1 rounded-2xl border px-2 py-3 ${
              i === 0
                ? "border-nova-400/40 bg-nova-400/10"
                : "border-nova-400/10 bg-nebula-800/40"
            }`}
          >
            <span className={`text-[11px] font-bold ${i === 0 ? "text-nova-300" : "text-stardust-300"}`}>
              {d.day}
            </span>
            <Icon icon={d.icon} />
            <span className="text-sm font-bold tabular-nums text-star-100">
              {d.high}° <span className="text-[11px] font-medium text-stardust-400">{d.low}°</span>
            </span>
            <span className="text-[10px] text-stardust-400">{d.label}</span>
            {d.precipChance > 20 && (
              <span className="text-[10px] font-semibold text-sky-300">💧 {d.precipChance}%</span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-stardust-500">Source: Open-Meteo · Marietta, GA</p>
    </Collapsible>
  );
}
