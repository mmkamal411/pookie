// GET /api/v1/travel/weather?zip= — W26 Weather (real NWS data).
//
// Keyless: NWS api.weather.gov (User-Agent required). Forecasts and alerts
// come only from NWS — never LLM-generated. Always carries the
// "not an emergency-alert system" contract flag for the UI disclaimer.
// D7: ZIP input only (coarse location); nothing precise is accepted.

import { handleRoute } from "@/server/rest";
import { ApiError, ErrorCodes, failWith } from "@/server/errors";
import { cacheGet, cacheSet, nwsGet, resolveZip } from "@/lib/travel/upstream";

interface NwsPoint {
  properties: { forecast: string; forecastHourly: string };
}
interface NwsForecast {
  properties: {
    periods: {
      name: string;
      startTime: string;
      temperature: number;
      temperatureUnit: string;
      shortForecast: string;
      detailedForecast: string;
      isDaytime: boolean;
    }[];
  };
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

export const GET = handleRoute(async (_ctx, req) => {
  const zip = new URL(req.url).searchParams.get("zip") ?? "";
  if (!/^\d{5}$/.test(zip.trim())) failWith(ErrorCodes.VALIDATION_FAILED);

  let point;
  try {
    point = await resolveZip(zip);
  } catch {
    throw new ApiError(ErrorCodes.NOT_FOUND);
  }

  try {
    const forecastKey = `wx:forecast:${point.zip}`;
    const alertsKey = `wx:alerts:${point.zip}`;
    let forecast = cacheGet<NwsForecast["properties"]["periods"]>(forecastKey);
    let alerts = cacheGet<NwsAlerts["features"]>(alertsKey);

    if (!forecast) {
      const meta = await nwsGet<NwsPoint>(
        `https://api.weather.gov/points/${point.lat.toFixed(4)},${point.lon.toFixed(4)}`,
      );
      const fc = await nwsGet<NwsForecast>(meta.properties.forecast);
      forecast = fc.properties.periods.slice(0, 14);
      cacheSet(forecastKey, forecast, 60 * 60 * 1000); // contract TTL: 1h
    }
    if (!alerts) {
      const al = await nwsGet<NwsAlerts>(
        `https://api.weather.gov/alerts/active?point=${point.lat.toFixed(4)},${point.lon.toFixed(4)}`,
      );
      alerts = al.features ?? [];
      cacheSet(alertsKey, alerts, 15 * 60 * 1000); // contract TTL: 15min
    }

    return {
      location: { zip: point.zip, city: point.city, state: point.state },
      source: "National Weather Service (api.weather.gov)",
      not_emergency_system: true,
      forecast: (forecast ?? []).map((p) => ({
        name: p.name,
        start_time: p.startTime,
        temperature_f: p.temperatureUnit === "F" ? p.temperature : Math.round((p.temperature * 9) / 5 + 32),
        short_forecast: p.shortForecast,
        detailed_forecast: p.detailedForecast,
        is_daytime: p.isDaytime,
      })),
      alerts: (alerts ?? []).map((a) => ({
        headline: a.properties.headline,
        description: a.properties.description,
        instruction: a.properties.instruction,
        severity: a.properties.severity,
        effective: a.properties.effective,
        expires: a.properties.expires,
      })),
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(ErrorCodes.UPSTREAM_UNAVAILABLE);
  }
});
