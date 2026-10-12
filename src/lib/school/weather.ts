// Weather shapes — client-safe. The server fetch lives in
// @/server/services/school-weather.

export type WeatherIcon = "sun" | "cloud-sun" | "cloud" | "rain" | "storm" | "snow" | "wind";

export interface WeatherDay {
  day: string;      // "Today" | "Tue" …
  date: string;     // "Oct 12"
  fullDate: string; // YYYY-MM-DD
  high: number;
  low: number;
  icon: WeatherIcon;
  label: string;
  precipChance: number;
}

/** Seasonal snapshot — the card never blanks when Open-Meteo is unreachable. */
export const WEATHER_FALLBACK: WeatherDay[] = [
  { day: "Today", date: "Oct 12", fullDate: "2026-10-12", high: 77, low: 58, icon: "sun", label: "Sunny", precipChance: 5 },
  { day: "Tue", date: "Oct 13", fullDate: "2026-10-13", high: 76, low: 60, icon: "cloud-sun", label: "Partly Cloudy", precipChance: 10 },
  { day: "Wed", date: "Oct 14", fullDate: "2026-10-14", high: 74, low: 59, icon: "rain", label: "Rain", precipChance: 60 },
  { day: "Thu", date: "Oct 15", fullDate: "2026-10-15", high: 75, low: 60, icon: "cloud-sun", label: "Partly Cloudy", precipChance: 15 },
  { day: "Fri", date: "Oct 16", fullDate: "2026-10-16", high: 79, low: 62, icon: "sun", label: "Sunny", precipChance: 5 },
];
