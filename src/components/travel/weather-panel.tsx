// W26 Weather — live NWS conditions + alerts for the coarse ZIP.
// Forecasts and alerts are NWS-verbatim, never LLM-generated. The
// "not an emergency-alert system" disclaimer is always visible; <18
// viewers always get the safety footer (sol-safety §5).

"use client";

import { useEffect, useState } from "react";
import { Badge, Card, InfoLine } from "@/components/ui";
import {
  ErrorCard,
  InitializingCard,
  LoadingRows,
  ZipGate,
  api,
  readStoredZip,
  storeZip,
} from "./travel-shared";

interface ForecastPeriod {
  name: string;
  temperature_f: number;
  short_forecast: string;
  detailed_forecast: string;
  is_daytime: boolean;
}
interface Alert {
  headline: string;
  description: string;
  instruction: string | null;
  severity: string;
  effective: string;
  expires: string;
}
interface WeatherData {
  location: { zip: string; city: string; state: string };
  source: string;
  forecast: ForecastPeriod[];
  alerts: Alert[];
}

const SEVERITY_TONE: Record<string, string> = {
  Extreme: "border-red-400/40 bg-red-500/10",
  Severe: "border-orange-400/40 bg-orange-500/10",
  Moderate: "border-amber-400/40 bg-amber-500/10",
  Minor: "border-stardust-500/25 bg-stardust-500/5",
};

export function WeatherPanel({ isTeen }: { isTeen: boolean }) {
  const [zip, setZip] = useState("");
  const [data, setData] = useState<WeatherData | null>(null);
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
    api<WeatherData>(`/api/v1/travel/weather?zip=${zip}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setState("loaded");
        }
      })
      .catch((e: Error & { code?: string }) => {
        if (cancelled) return;
        setError(
          e.code === "UPSTREAM_UNAVAILABLE"
            ? "The National Weather Service is not responding right now."
            : e.message,
        );
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [zip, nonce]);

  return (
    <div className="space-y-4">
      <InfoLine>
        Pookie isn&apos;t an emergency-alert system — for severe weather, follow official alerts
        from the National Weather Service.
      </InfoLine>

      <ZipGate
        value={zip}
        label="Where does your day happen?"
        onChange={(z) => {
          setZip(z);
          storeZip(z);
        }}
      />

      {state === "idle" && (
        <InitializingCard
          title="Add your ZIP to see the sky"
          message="Pookie pulls the live forecast from the National Weather Service — no account, no tracking, just weather."
        />
      )}
      {state === "loading" && <LoadingRows rows={4} />}
      {state === "error" && (
        <ErrorCard message={error} onRetry={() => setNonce((n) => n + 1)} />
      )}

      {state === "loaded" && data && (
        <>
          <p className="text-xs text-stardust-500">
            {data.location.city}, {data.location.state} {data.location.zip} · {data.source}
          </p>

          {data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((a, i) => (
                <Card key={i} className={SEVERITY_TONE[a.severity] ?? SEVERITY_TONE.Minor}>
                  <div className="flex items-center gap-2">
                    <Badge tone="warning">{a.severity}</Badge>
                    <p className="text-sm font-semibold text-star-100">{a.headline}</p>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-stardust-300">
                    {a.description.slice(0, 400)}
                    {a.description.length > 400 ? "…" : ""}
                  </p>
                  {a.instruction && (
                    <p className="mt-1.5 text-[13px] font-medium text-star-100">
                      What to do: {a.instruction.slice(0, 300)}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-stardust-500">
                    Official NWS alert · effective {new Date(a.effective).toLocaleString()} · expires{" "}
                    {new Date(a.expires).toLocaleString()}
                  </p>
                </Card>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {data.forecast.map((p, i) => (
              <Card key={i} padding="sm" className="flex items-center gap-3">
                <span aria-hidden="true" className="text-xl">
                  {p.is_daytime ? "☀️" : "🌙"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-star-100">{p.name}</p>
                  <p className="text-[13px] text-stardust-300">{p.short_forecast}</p>
                </div>
                <span className="shrink-0 text-lg font-semibold text-star-100">
                  {p.temperature_f}°
                </span>
              </Card>
            ))}
          </div>

          {isTeen && (
            <InfoLine tone="teal" icon="🌤️">
              Weather is just information — it never decides what you should do. If skies look
              rough, check with a grown-up before heading out.
            </InfoLine>
          )}
        </>
      )}
    </div>
  );
}
