// 5-day weather for Marietta, GA — Open-Meteo (free, no key).
// Server-side fetch with a short in-memory cache + graceful fallback so the
// weather section never blanks the page.

import { WEATHER_FALLBACK, type WeatherDay, type WeatherIcon } from "@/lib/school/weather";

const MARIETTA = { lat: 33.95, lon: -84.55 };

function codeToIcon(code: number): WeatherIcon {
  if (code === 0) return "sun";
  if (code === 1 || code === 2) return "cloud-sun";
  if (code === 3 || code === 45 || code === 48) return "cloud";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 95) return "storm";
  return "cloud";
}

function codeToLabel(code: number): string {
  if (code === 0) return "Sunny";
  if (code === 1) return "Mostly Sunny";
  if (code === 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 95) return "Storms";
  return "Cloudy";
}

let cache: { date: string; days: WeatherDay[] } | null = null;

export async function getWeatherForecast(): Promise<{ days: WeatherDay[]; live: boolean }> {
  const todayKey = new Date().toISOString().slice(0, 10);
  if (cache && cache.date === todayKey && cache.days.length >= 5) {
    return { days: cache.days.slice(0, 5), live: true };
  }
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${MARIETTA.lat}&longitude=${MARIETTA.lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max` +
      `&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=7`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`weather ${res.status}`);
    const data = (await res.json()) as {
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        weathercode?: number[];
        precipitation_probability_max?: number[];
      };
    };
    const d = data.daily;
    if (!d?.time?.length) throw new Error("bad shape");
    const days: WeatherDay[] = d.time.map((t, i) => {
      const date = new Date(t + "T12:00:00");
      const code = d.weathercode?.[i] ?? 3;
      return {
        day: i === 0 ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" }),
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        fullDate: t,
        high: Math.round(d.temperature_2m_max?.[i] ?? 75),
        low: Math.round(d.temperature_2m_min?.[i] ?? 60),
        icon: codeToIcon(code),
        label: codeToLabel(code),
        precipChance: d.precipitation_probability_max?.[i] ?? 0,
      };
    });
    cache = { date: todayKey, days };
    return { days: days.slice(0, 5), live: true };
  } catch {
    return { days: WEATHER_FALLBACK, live: false };
  }
}
