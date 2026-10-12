// W26 Household Weather — standalone household weather experience.
// NWS api.weather.gov (free, no key) as the primary source: current
// observations, 7-day forecast, hourly, and active alerts. Open-Meteo is the
// keyless fallback when NWS is unreachable; a graceful standby payload is
// returned when both are down (the UI never blanks).
//
// Server-side only. 1-hour in-memory TTL (same process-local pattern as
// src/lib/travel/upstream.ts until external_data_cache lands).
//
// MD D7: coarse ZIP input only — never precise GPS.

import {
  cacheGet,
  cacheSet,
  nwsGet,
  resolveZip,
  type ZipPoint,
} from "@/lib/travel/upstream";

export type ConditionKind =
  | "clear"
  | "partly"
  | "cloudy"
  | "rain"
  | "storm"
  | "snow"
  | "fog"
  | "wind";

export interface WeatherCurrent {
  tempF: number;
  feelsLikeF: number;
  humidity: number | null;
  windMph: number;
  windDir: string;
  windGustMph: number | null;
  visibilityMi: number | null;
  shortForecast: string;
  condition: ConditionKind;
  isDaytime: boolean;
  sunrise: string | null;
  sunset: string | null;
  observedAt: string;
}

export interface WeatherDay {
  date: string;
  weekday: string;
  highF: number;
  lowF: number;
  condition: ConditionKind;
  shortForecast: string;
  precipChance: number;
}

export interface WeatherHour {
  label: string;
  tempF: number;
  condition: ConditionKind;
  precipChance: number;
  shortForecast: string;
}

export interface WeatherAlert {
  headline: string;
  description: string;
  instruction: string | null;
  severity: string;
  effective: string;
  expires: string;
}

export interface HouseholdWeather {
  location: { zip: string; city: string; state: string; lat: number; lon: number };
  current: WeatherCurrent | null;
  days: WeatherDay[];
  hourly: WeatherHour[];
  alerts: WeatherAlert[];
  live: boolean;
  source: string;
  fetchedAt: string;
}

interface NwsPoints {
  properties: {
    forecast: string;
    forecastHourly: string;
    observationStations: string;
  };
}

interface NwsForecastPeriod {
  name: string;
  startTime: string;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  isDaytime: boolean;
  icon: string;
  probabilityOfPrecipitation?: { value: number | null };
}

interface NwsForecast {
  properties: { periods: NwsForecastPeriod[] };
}

interface NwsObservationValue {
  value: number | string | null;
}

interface NwsObservation {
  properties: {
    timestamp: string;
    textDescription: string | null;
    temperature: NwsObservationValue;
    relativeHumidity: NwsObservationValue;
    heatIndex: NwsObservationValue;
    windChill: NwsObservationValue;
    windDirection: NwsObservationValue;
    windSpeed: NwsObservationValue;
    windGust: NwsObservationValue;
    visibility: NwsObservationValue;
    icon: string | null;
  };
}

interface NwsStations {
  features: { id: string }[];
}

interface NwsAlerts {
  features: {
    properties: {
      headline: string;
      description: string;
      instruction: string | null;
      severity: string;
      effective: string;
      expires: string;
    };
  }[];
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

function cacheKey(zip: string): string {
  return `wx:household:${zip}`;
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function degToCompass(deg: number): string {
  return COMPASS[Math.round(deg / 22.5) % 16];
}

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

function kmhToMph(kmh: number): number {
  return kmh * 0.621371;
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse an NWS icon URL like
 * https://api.weather.gov/icons/land/day/sct,ra?size=medium
 * into a ConditionKind. Day/night is kept for clear/partly glow tuning.
 */
export function nwsIconToCondition(icon: string | null | undefined): {
  condition: ConditionKind;
  isDaytime: boolean;
} {
  if (!icon) return { condition: "cloudy", isDaytime: true };
  const isDaytime = !/\/night\//.test(icon);
  const tail = (icon.split("?")[0] ?? "").split("/").pop() ?? "";
  const raw = tail.split(",")[0] ?? "";
  const code = raw.replace(/^wind_/, "");
  if (/^(skc|few)$/.test(code)) return { condition: "clear", isDaytime };
  if (/^sct$/.test(code)) return { condition: "partly", isDaytime };
  if (/^(bkn|ovc)$/.test(code)) return { condition: "cloudy", isDaytime };
  if (/^(sn|blizzard|ip)$/.test(code)) return { condition: "snow", isDaytime };
  if (/^(sleet|fzra|rain_fzra|rain_sleet)$/.test(code)) return { condition: "rain", isDaytime };
  if (/^tsra$/.test(code)) return { condition: "storm", isDaytime };
  if (/^(ra|shra|rain_showers)$/.test(code)) return { condition: "rain", isDaytime };
  if (/^(fog|haze|smoke|dust|ash)$/.test(code)) return { condition: "fog", isDaytime };
  if (/^wind_/.test(raw)) return { condition: "wind", isDaytime };
  return { condition: "cloudy", isDaytime };
}

function omCodeToCondition(code: number): ConditionKind {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly";
  if (code === 3 || code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 95) return "storm";
  return "cloudy";
}

function toF(nwsTemp: number, unit: string): number {
  return unit === "F" ? Math.round(nwsTemp) : Math.round(cToF(nwsTemp));
}

function groupDays(periods: NwsForecastPeriod[]): WeatherDay[] {
  // NWS periods alternate day/night ("Monday" / "Monday Night").
  // Group by local calendar date: daytime feeds highs, nighttime feeds lows.
  const byDate = new Map<string, NwsForecastPeriod[]>();
  for (const p of periods) {
    const d = new Date(p.startTime);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const arr = byDate.get(key) ?? [];
    arr.push(p);
    byDate.set(key, arr);
  }
  const days: WeatherDay[] = [];
  for (const [, ps] of byDate) {
    const dayPs = ps.filter((p) => p.isDaytime);
    const nightPs = ps.filter((p) => !p.isDaytime);
    const highs = dayPs.map((p) => toF(p.temperature, p.temperatureUnit));
    const lows = nightPs.map((p) => toF(p.temperature, p.temperatureUnit));
    const all = ps.map((p) => toF(p.temperature, p.temperatureUnit));
    const hi = highs.length ? Math.max(...highs) : Math.max(...all);
    const lo = lows.length ? Math.min(...lows) : Math.min(...all);
    const anchor = dayPs[0] ?? ps[0];
    const { condition } = nwsIconToCondition(anchor.icon);
    const precip = Math.max(
      ...ps.map((p) => p.probabilityOfPrecipitation?.value ?? 0),
    );
    const date = new Date(anchor.startTime);
    const today = new Date();
    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
    days.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      weekday: isToday
        ? "Today"
        : date.toLocaleDateString("en-US", { weekday: "short" }),
      highF: hi,
      lowF: lo,
      condition,
      shortForecast: anchor.shortForecast,
      precipChance: Math.round(precip),
    });
    if (days.length >= 7) break;
  }
  return days;
}

function hourLabel(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h} ${ampm}`;
}

function next24Hours(periods: NwsForecastPeriod[]): WeatherHour[] {
  const now = Date.now();
  return periods
    .filter((p) => new Date(p.startTime).getTime() + 60 * 60 * 1000 > now)
    .slice(0, 24)
    .map((p) => {
      const { condition } = nwsIconToCondition(p.icon);
      return {
        label: hourLabel(p.startTime),
        tempF: toF(p.temperature, p.temperatureUnit),
        condition,
        precipChance: Math.round(p.probabilityOfPrecipitation?.value ?? 0),
        shortForecast: p.shortForecast,
      };
    });
}

const SEVERITY_ORDER = ["Extreme", "Severe", "Moderate", "Minor", "Unknown"];

function sortAlerts(alerts: WeatherAlert[]): WeatherAlert[] {
  return alerts
    .slice()
    .sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
    )
    .slice(0, 5);
}

async function fetchSunTimes(lat: number, lon: number): Promise<{
  sunrise: string | null;
  sunset: string | null;
}> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
        `&daily=sunrise,sunset&timezone=America%2FNew_York&forecast_days=1`,
      { headers: { "User-Agent": "Pookie/1.0 (support@pookie.app)" } },
    );
    if (!res.ok) return { sunrise: null, sunset: null };
    const json = (await res.json()) as {
      daily?: { sunrise?: string[]; sunset?: string[] };
    };
    const fmt = (iso: string | undefined): string | null => {
      if (!iso) return null;
      const d = new Date(iso);
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      });
    };
    return {
      sunrise: fmt(json.daily?.sunrise?.[0]),
      sunset: fmt(json.daily?.sunset?.[0]),
    };
  } catch {
    return { sunrise: null, sunset: null };
  }
}

/** Full NWS path: current observations + 7-day + hourly + alerts. */
async function fetchFromNws(point: ZipPoint): Promise<HouseholdWeather> {
  const { lat, lon } = point;
  const meta = await nwsGet<NwsPoints>(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
  );
  const [fc, hourly, stations] = await Promise.all([
    nwsGet<NwsForecast>(meta.properties.forecast),
    nwsGet<NwsForecast>(meta.properties.forecastHourly),
    nwsGet<NwsStations>(meta.properties.observationStations),
  ]);

  // Latest observation from the nearest station.
  let current: WeatherCurrent | null = null;
  const stationId = stations.features?.[0]?.id;
  if (stationId) {
    try {
      const obs = await nwsGet<NwsObservation>(
        `https://api.weather.gov/stations/${stationId}/observations/latest`,
      );
      const p = obs.properties;
      const tempC = num(p.temperature.value);
      const heatC = num(p.heatIndex.value);
      const chillC = num(p.windChill.value);
      const tempF = tempC === null ? null : Math.round(cToF(tempC));
      let feelsF = tempF;
      if (tempF !== null) {
        if (tempF >= 80 && heatC !== null) feelsF = Math.round(cToF(heatC));
        else if (tempF <= 50 && chillC !== null) feelsF = Math.round(cToF(chillC));
      }
      const windKmh = num(p.windSpeed.value);
      const gustKmh = num(p.windGust.value);
      const windDeg = num(p.windDirection.value);
      const visM = num(p.visibility.value);
      const { condition, isDaytime } = nwsIconToCondition(p.icon);
      const { sunrise, sunset } = await fetchSunTimes(lat, lon);
      current = {
        tempF: tempF ?? 0,
        feelsLikeF: feelsF ?? 0,
        humidity: num(p.relativeHumidity.value) === null ? null : Math.round(num(p.relativeHumidity.value) as number),
        windMph: windKmh === null ? 0 : Math.round(kmhToMph(windKmh)),
        windDir: windDeg === null ? "—" : degToCompass(windDeg),
        windGustMph: gustKmh === null ? null : Math.round(kmhToMph(gustKmh)),
        visibilityMi: visM === null ? null : Math.round((visM / 1609.34) * 10) / 10,
        shortForecast: p.textDescription ?? "",
        condition,
        isDaytime,
        sunrise,
        sunset,
        observedAt: p.timestamp,
      };
    } catch {
      // Observation failed — forecast still carries the module.
      current = null;
    }
  }

  // If no station observation, seed "current" from the first hourly period.
  if (!current && hourly.properties.periods.length) {
    const p = hourly.properties.periods[0];
    const { condition, isDaytime } = nwsIconToCondition(p.icon);
    const { sunrise, sunset } = await fetchSunTimes(lat, lon);
    const t = toF(p.temperature, p.temperatureUnit);
    current = {
      tempF: t,
      feelsLikeF: t,
      humidity: null,
      windMph: 0,
      windDir: "—",
      windGustMph: null,
      visibilityMi: null,
      shortForecast: p.shortForecast,
      condition,
      isDaytime,
      sunrise,
      sunset,
      observedAt: p.startTime,
    };
  }

  let alerts: WeatherAlert[] = [];
  try {
    const al = await nwsGet<NwsAlerts>(
      `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
    );
    alerts = sortAlerts(
      (al.features ?? []).map((f) => ({
        headline: f.properties.headline,
        description: f.properties.description,
        instruction: f.properties.instruction,
        severity: f.properties.severity,
        effective: f.properties.effective,
        expires: f.properties.expires,
      })),
    );
  } catch {
    alerts = [];
  }

  return {
    location: {
      zip: point.zip,
      city: point.city,
      state: point.state,
      lat,
      lon,
    },
    current,
    days: groupDays(fc.properties.periods),
    hourly: next24Hours(hourly.properties.periods),
    alerts,
    live: true,
    source: "National Weather Service (api.weather.gov)",
    fetchedAt: new Date().toISOString(),
  };
}

/** Open-Meteo fallback: 7-day + hourly when NWS is unreachable. */
async function fetchFromOpenMeteo(point: ZipPoint): Promise<HouseholdWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${point.lat.toFixed(4)}&longitude=${point.lon.toFixed(4)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=7`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Pookie/1.0 (support@pookie.app)" },
  });
  if (!res.ok) throw new Error("upstream_unavailable");
  const d = (await res.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      apparent_temperature?: number;
      weather_code?: number;
      wind_speed_10m?: number;
      wind_direction_10m?: number;
      wind_gusts_10m?: number;
    };
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      weather_code?: number[];
      precipitation_probability?: number[];
    };
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      weather_code?: number[];
      precipitation_probability_max?: number[];
      sunrise?: string[];
      sunset?: string[];
    };
  };
  const cur = d.current;
  const now = Date.now();
  const hourly: WeatherHour[] = [];
  if (d.hourly?.time?.length) {
    for (let i = 0; i < d.hourly.time.length && hourly.length < 24; i++) {
      const t = new Date(d.hourly.time[i]).getTime();
      if (t + 60 * 60 * 1000 <= now) continue;
      hourly.push({
        label: hourLabel(d.hourly.time[i]),
        tempF: Math.round(d.hourly.temperature_2m?.[i] ?? 0),
        condition: omCodeToCondition(d.hourly.weather_code?.[i] ?? 3),
        precipChance: Math.round(d.hourly.precipitation_probability?.[i] ?? 0),
        shortForecast: "",
      });
    }
  }
  const days: WeatherDay[] = [];
  if (d.daily?.time?.length) {
    d.daily.time.forEach((t, i) => {
      const date = new Date(t + "T12:00:00");
      const isToday = i === 0;
      days.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        weekday: isToday
          ? "Today"
          : date.toLocaleDateString("en-US", { weekday: "short" }),
        highF: Math.round(d.daily?.temperature_2m_max?.[i] ?? 0),
        lowF: Math.round(d.daily?.temperature_2m_min?.[i] ?? 0),
        condition: omCodeToCondition(d.daily?.weather_code?.[i] ?? 3),
        shortForecast: "",
        precipChance: Math.round(
          d.daily?.precipitation_probability_max?.[i] ?? 0,
        ),
      });
    });
  }
  const fmtSun = (iso: string | undefined): string | null => {
    if (!iso) return null;
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });
  };
  const cond = omCodeToCondition(cur?.weather_code ?? 3);
  return {
    location: {
      zip: point.zip,
      city: point.city,
      state: point.state,
      lat: point.lat,
      lon: point.lon,
    },
    current: cur
      ? {
          tempF: Math.round(cur.temperature_2m ?? 0),
          feelsLikeF: Math.round(cur.apparent_temperature ?? cur.temperature_2m ?? 0),
          humidity: cur.relative_humidity_2m ?? null,
          windMph: Math.round(cur.wind_speed_10m ?? 0),
          windDir: cur.wind_direction_10m === undefined ? "—" : degToCompass(cur.wind_direction_10m),
          windGustMph: cur.wind_gusts_10m === undefined ? null : Math.round(cur.wind_gusts_10m),
          visibilityMi: null,
          shortForecast: "",
          condition: cond,
          isDaytime: true,
          sunrise: fmtSun(d.daily?.sunrise?.[0]),
          sunset: fmtSun(d.daily?.sunset?.[0]),
          observedAt: new Date().toISOString(),
        }
      : null,
    days,
    hourly,
    alerts: [],
    live: true,
    source: "Open-Meteo (fallback while NWS is unreachable)",
    fetchedAt: new Date().toISOString(),
  };
}

function standby(point: ZipPoint): HouseholdWeather {
  return {
    location: {
      zip: point.zip,
      city: point.city,
      state: point.state,
      lat: point.lat,
      lon: point.lon,
    },
    current: null,
    days: [],
    hourly: [],
    alerts: [],
    live: false,
    source: "Forecast services unreachable",
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Household weather for a ZIP. Never throws on upstream failure —
 * returns a graceful standby payload so the UI can stay beautiful.
 * Throws only when the ZIP itself cannot be resolved.
 */
export async function getHouseholdWeather(zip: string): Promise<HouseholdWeather> {
  const point = await resolveZip(zip); // throws bad_zip / zip_not_found
  const key = cacheKey(point.zip);
  const cached = cacheGet<HouseholdWeather>(key);
  if (cached) return cached;

  let payload: HouseholdWeather;
  try {
    payload = await fetchFromNws(point);
  } catch {
    try {
      payload = await fetchFromOpenMeteo(point);
    } catch {
      payload = standby(point);
    }
  }
  // Only cache live payloads; standby is retried on every load.
  if (payload.live) cacheSet(key, payload, CACHE_TTL_MS);
  return payload;
}
