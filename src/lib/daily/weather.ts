/**
 * Live 5-day forecast via Open-Meteo (free, no key) — ported from d-dash.
 * Cached in localStorage per calendar day so the API is hit at most once a
 * day; any failure (offline, bad shape) falls back to the static strip so
 * the home page never breaks. Safe to call during SSR (returns fallback).
 *
 * Default coordinates: Marietta, GA (Dawson's home). Callers may pass
 * their own coordinates for other families.
 */

export interface WeatherDay {
  day: string;
  temp: number;
  icon: "sun" | "cloud-sun" | "cloud" | "rain";
  label: string;
}

const FALLBACK_WEATHER: WeatherDay[] = [
  { day: "Tue", temp: 72, icon: "sun", label: "Sunny" },
  { day: "Wed", temp: 74, icon: "sun", label: "Sunny" },
  { day: "Thu", temp: 71, icon: "cloud", label: "Cloudy" },
  { day: "Fri", temp: 69, icon: "rain", label: "Rain" },
  { day: "Sat", temp: 70, icon: "sun", label: "Sunny" },
];

const WEATHER_CACHE_KEY = "pookie-weather";
const MARIETTA = { lat: 33.95, lon: -84.55 };

function codeToIcon(code: number): { icon: WeatherDay["icon"]; label: string } {
  if (code === 0) return { icon: "sun", label: "Sunny" };
  if (code === 1 || code === 2) return { icon: "cloud-sun", label: "Partly cloudy" };
  if (code === 3 || code === 45 || code === 48) return { icon: "cloud", label: "Cloudy" };
  return { icon: "rain", label: "Rain" };
}

export async function fetchLiveWeather(
  lat: number = MARIETTA.lat,
  lon: number = MARIETTA.lon
): Promise<WeatherDay[]> {
  if (typeof window === "undefined") return FALLBACK_WEATHER;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = window.localStorage.getItem(WEATHER_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as { date: string; days: WeatherDay[] };
      if (cached.date === today && Array.isArray(cached.days) && cached.days.length === 5) {
        return cached.days;
      }
    }
  } catch {
    /* corrupt cache — refetch */
  }
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,weathercode&temperature_unit=fahrenheit` +
      `&timezone=America%2FNew_York&forecast_days=5`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`weather ${res.status}`);
    const data = (await res.json()) as {
      daily?: { time?: string[]; temperature_2m_max?: number[]; weathercode?: number[] };
    };
    const times = data.daily?.time ?? [];
    const temps = data.daily?.temperature_2m_max ?? [];
    const codes = data.daily?.weathercode ?? [];
    if (times.length < 5 || temps.length < 5 || codes.length < 5) throw new Error("weather shape");
    const days: WeatherDay[] = times.slice(0, 5).map((t, i) => {
      const { icon, label } = codeToIcon(Number(codes[i]));
      return {
        day: new Date(`${t}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
        temp: Math.round(Number(temps[i])),
        icon,
        label,
      };
    });
    try {
      window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ date: today, days }));
    } catch {
      /* storage full/blocked — serve fresh anyway */
    }
    return days;
  } catch {
    return FALLBACK_WEATHER;
  }
}
