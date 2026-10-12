// W26 Weather Hub — the standalone household weather experience.
// Cosmic hero with condition-matched ambient glow (gold sun, ice-blue rain,
// violet storms), CSS-animated condition art, current conditions, today's
// hourly strip, 7-day outlook with temp-range bars, NWS alerts, and a home
// ZIP setter. Every state renders beautifully: shimmer loading, graceful
// standby with retry — never a blank page.
//
// D7: ZIP input only (coarse location). NWS alerts are verbatim — the
// "not an emergency-alert system" line is always visible.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ConditionKind,
  HouseholdWeather,
} from "@/server/services/weather";
import { Card, Badge, Button, EmptyState, BackButton } from "@/components/ui";

const ZIP_KEY = "pookie.travel.zip"; // shared home ZIP with the travel module

interface ApiPayload extends HouseholdWeather {
  defaulted: boolean;
  not_emergency_system: boolean;
}

type LoadState = "loading" | "ready" | "standby";

const CONDITION_EMOJI: Record<ConditionKind, string> = {
  clear: "☀️",
  partly: "⛅",
  cloudy: "☁️",
  rain: "🌧️",
  storm: "⛈️",
  snow: "🌨️",
  fog: "🌫️",
  wind: "💨",
};

const CONDITION_LABEL: Record<ConditionKind, string> = {
  clear: "Clear Skies",
  partly: "Partly Cloudy",
  cloudy: "Overcast",
  rain: "Rain",
  storm: "Storms",
  snow: "Snow",
  fog: "Fog",
  wind: "Windy",
};

/** Ambient glow colors per condition: [core, halo]. */
const CONDITION_GLOW: Record<string, [string, string]> = {
  "clear-day": ["rgba(246,196,83,0.32)", "rgba(246,150,60,0.10)"],
  "clear-night": ["rgba(107,124,255,0.30)", "rgba(60,70,180,0.12)"],
  partly: ["rgba(120,200,220,0.26)", "rgba(246,196,83,0.10)"],
  cloudy: ["rgba(110,150,180,0.24)", "rgba(90,120,150,0.10)"],
  rain: ["rgba(77,178,255,0.30)", "rgba(40,110,200,0.12)"],
  storm: ["rgba(139,92,246,0.34)", "rgba(90,50,200,0.14)"],
  snow: ["rgba(191,227,255,0.30)", "rgba(140,190,240,0.12)"],
  fog: ["rgba(154,147,184,0.28)", "rgba(120,110,160,0.12)"],
  wind: ["rgba(120,200,200,0.26)", "rgba(80,160,160,0.10)"],
};

function glowFor(condition: ConditionKind, isDaytime: boolean): [string, string] {
  if (condition === "clear") return CONDITION_GLOW[isDaytime ? "clear-day" : "clear-night"];
  return CONDITION_GLOW[condition] ?? CONDITION_GLOW.cloudy;
}

/* ---------------- Condition art: pure CSS, animated ---------------- */

function ConditionArt({ condition, isDaytime }: { condition: ConditionKind; isDaytime: boolean }) {
  return (
    <div className="wx-art relative mx-auto h-36 w-36" aria-hidden="true">
      {(condition === "clear" || condition === "partly") && isDaytime && (
        <>
          <div className="wx-sun-core" />
          <div className="wx-sun-rays" />
        </>
      )}
      {condition === "clear" && !isDaytime && (
        <>
          <div className="wx-moon" />
          <div className="wx-star wx-s1" />
          <div className="wx-star wx-s2" />
          <div className="wx-star wx-s3" />
        </>
      )}
      {condition !== "clear" && (
        <>
          <div className="wx-cloud wx-c1" />
          <div className="wx-cloud wx-c2" />
        </>
      )}
      {condition === "partly" && isDaytime && <div className="wx-sun-peek" />}
      {condition === "rain" && (
        <div className="wx-drops">
          <span className="wx-drop wx-d1" /><span className="wx-drop wx-d2" />
          <span className="wx-drop wx-d3" /><span className="wx-drop wx-d4" />
        </div>
      )}
      {condition === "storm" && (
        <>
          <div className="wx-drops">
            <span className="wx-drop wx-d1" /><span className="wx-drop wx-d3" />
          </div>
          <div className="wx-bolt" />
        </>
      )}
      {condition === "snow" && (
        <div className="wx-flakes">
          <span className="wx-flake wx-f1" /><span className="wx-flake wx-f2" />
          <span className="wx-flake wx-f3" /><span className="wx-flake wx-f4" />
        </div>
      )}
      {condition === "fog" && (
        <div className="wx-fogbands">
          <span className="wx-fogband wx-b1" /><span className="wx-fogband wx-b2" />
          <span className="wx-fogband wx-b3" />
        </div>
      )}
      {condition === "wind" && <div className="wx-windlines">
        <span className="wx-windline wx-w1" /><span className="wx-windline wx-w2" /><span className="wx-windline wx-w3" />
      </div>}
    </div>
  );
}

const ART_CSS = `
.wx-art{filter:drop-shadow(0 0 24px rgba(160,180,255,.25))}
.wx-sun-core{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;
  background:radial-gradient(circle at 35% 35%,#fff7d6,#ffd166 55%,#f59e0b 100%);
  box-shadow:0 0 40px 12px rgba(246,196,83,.55)}
.wx-sun-rays{position:absolute;left:50%;top:50%;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;
  background:repeating-conic-gradient(rgba(246,196,83,.5) 0 6deg,transparent 6deg 18deg);
  -webkit-mask:radial-gradient(circle,transparent 34px,#000 36px);mask:radial-gradient(circle,transparent 34px,#000 36px);
  animation:wx-spin 24s linear infinite}
.wx-sun-peek{position:absolute;left:18px;top:22px;width:52px;height:52px;border-radius:50%;
  background:radial-gradient(circle at 35% 35%,#fff7d6,#ffd166 60%,#f59e0b);box-shadow:0 0 28px 8px rgba(246,196,83,.5)}
.wx-moon{position:absolute;left:50%;top:50%;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;
  background:radial-gradient(circle at 65% 35%,transparent 42%,#e8ecff 44%);
  filter:drop-shadow(0 0 18px rgba(200,210,255,.6))}
.wx-star{position:absolute;width:5px;height:5px;border-radius:50%;background:#dfe6ff;animation:wx-twinkle 2.6s ease-in-out infinite}
.wx-s1{left:18%;top:16%}.wx-s2{left:78%;top:30%;animation-delay:.9s}.wx-s3{left:64%;top:78%;animation-delay:1.7s}
.wx-cloud{position:absolute;border-radius:999px;background:linear-gradient(180deg,#f2f4ff 0%,#c9d2f2 60%,#aab6dd 100%);
  box-shadow:0 8px 24px rgba(140,160,220,.35)}
.wx-c1{left:14%;top:34%;width:88px;height:34px;animation:wx-drift 7s ease-in-out infinite}
.wx-c2{left:30%;top:22%;width:64px;height:26px;opacity:.85;animation:wx-drift 9s ease-in-out infinite reverse}
.wx-drop{position:absolute;top:78px;width:2.5px;height:14px;border-radius:2px;
  background:linear-gradient(180deg,transparent,#7cc4ff);animation:wx-fall 1.1s linear infinite}
.wx-d1{left:32%}.wx-d2{left:46%;animation-delay:.3s}.wx-d3{left:60%;animation-delay:.6s}.wx-d4{left:74%;animation-delay:.15s}
.wx-bolt{position:absolute;left:50%;top:64px;width:26px;height:52px;margin-left:-13px;
  background:linear-gradient(180deg,#fef9c3,#facc15);clip-path:polygon(55% 0,15% 58%,42% 58%,30% 100%,80% 42%,52% 42%);
  filter:drop-shadow(0 0 12px rgba(250,204,21,.9));animation:wx-flicker 2.4s ease-in-out infinite}
.wx-flake{position:absolute;top:76px;width:6px;height:6px;border-radius:50%;background:#eaf4ff;
  box-shadow:0 0 6px rgba(220,240,255,.9);animation:wx-snowfall 3.2s linear infinite}
.wx-f1{left:30%}.wx-f2{left:48%;animation-delay:1s}.wx-f3{left:64%;animation-delay:2s}.wx-f4{left:76%;animation-delay:.5s}
.wx-fogband{position:absolute;left:10%;width:80%;height:9px;border-radius:999px;
  background:linear-gradient(90deg,transparent,rgba(200,205,230,.75),transparent);animation:wx-drift 6s ease-in-out infinite}
.wx-b1{top:66px}.wx-b2{top:84px;animation-delay:1.2s}.wx-b3{top:102px;animation-delay:2.4s}
.wx-windline{position:absolute;left:8%;height:3px;border-radius:3px;
  background:linear-gradient(90deg,transparent,rgba(160,220,230,.9),transparent);animation:wx-wind 2.8s ease-in-out infinite}
.wx-w1{top:52px;width:70%}.wx-w2{top:72px;width:88%;animation-delay:.7s}.wx-w3{top:92px;width:60%;animation-delay:1.4s}
@keyframes wx-spin{to{transform:rotate(360deg)}}
@keyframes wx-drift{0%,100%{transform:translateX(-6px)}50%{transform:translateX(8px)}}
@keyframes wx-fall{0%{transform:translateY(-6px);opacity:0}30%{opacity:1}100%{transform:translateY(30px);opacity:0}}
@keyframes wx-snowfall{0%{transform:translate(0,-4px);opacity:0}25%{opacity:1}100%{transform:translate(-10px,34px);opacity:0}}
@keyframes wx-flicker{0%,100%{opacity:1}8%{opacity:.25}12%{opacity:1}46%{opacity:1}52%{opacity:.4}58%{opacity:1}}
@keyframes wx-twinkle{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.25)}}
@keyframes wx-wind{0%,100%{transform:translateX(-8px);opacity:.4}50%{transform:translateX(10px);opacity:1}}
@keyframes wx-breathe{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.03)}}
.wx-glow{animation:wx-breathe 6s ease-in-out infinite}
.wx-skeleton{background:linear-gradient(100deg,rgba(120,130,200,.08) 40%,rgba(150,165,230,.16) 50%,rgba(120,130,200,.08) 60%);
  background-size:200% 100%;animation:wx-shimmer 1.6s linear infinite}
@keyframes wx-shimmer{to{background-position:-200% 0}}
`;

/* ---------------- small pieces ---------------- */

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stardust-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-star-100">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-stardust-400">{sub}</p>}
    </div>
  );
}

function WindArrow({ dir }: { dir: string }) {
  const deg: Record<string, number> = {
    N: 0, NNE: 22, NE: 45, ENE: 67, E: 90, ESE: 112, SE: 135, SSE: 157,
    S: 180, SSW: 202, SW: 225, WSW: 247, W: 270, WNW: 292, NW: 315, NNW: 337,
  };
  const r = deg[dir];
  if (r === undefined) return null;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${r}deg)` }}
      className="inline-block text-stardust-300"
      aria-hidden="true"
    >
      <path d="M12 3 L17 12 L12 9.5 L7 12 Z M12 9.5 L12 21" fill="currentColor" />
    </svg>
  );
}

const SEVERITY_STYLE: Record<string, string> = {
  Extreme: "border-red-400/50 bg-red-500/10 text-red-200",
  Severe: "border-orange-400/50 bg-orange-500/10 text-orange-200",
  Moderate: "border-amber-400/50 bg-amber-500/10 text-amber-200",
  Minor: "border-stardust-500/40 bg-stardust-500/10 text-stardust-200",
};

function AlertCard({ alert }: { alert: ApiPayload["alerts"][number] }) {
  const tone = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.Minor;
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true">⚠️</span>
        <p className="text-sm font-semibold">{alert.headline}</p>
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-relaxed opacity-90">{alert.description}</p>
      {alert.instruction && (
        <p className="mt-2 text-xs leading-relaxed opacity-90">
          <span className="font-semibold">What To Do: </span>
          {alert.instruction}
        </p>
      )}
      <p className="mt-2 text-[11px] opacity-70">
        {alert.severity} · Effective{" "}
        {new Date(alert.effective).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

/* ---------------- the hub ---------------- */

export function WeatherHub() {
  const [zip, setZip] = useState("");
  const [draftZip, setDraftZip] = useState("");
  const [data, setData] = useState<ApiPayload | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    try {
      setZip(window.localStorage.getItem(ZIP_KEY) ?? "");
    } catch {
      setZip("");
    }
  }, []);

  const load = useCallback(async (targetZip: string) => {
    setState("loading");
    try {
      const res = await fetch(
        `/api/v1/household/weather${targetZip ? `?zip=${encodeURIComponent(targetZip)}` : ""}`,
      );
      const json = (await res.json()) as
        | { ok: true; data: ApiPayload }
        | { ok: false; error?: { message?: string } };
      if (!json.ok) throw new Error(json.error?.message ?? "The sky is unreachable right now.");
      setData(json.data);
      setState("ready");
    } catch {
      setData(null);
      setState("standby");
    }
  }, []);

  useEffect(() => {
    load(zip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip, nonce]);

  const glow = useMemo(() => {
    const c = data?.current?.condition ?? "partly";
    const day = data?.current?.isDaytime ?? true;
    return glowFor(c, day);
  }, [data]);

  const [glo, halo] = glow;
  const tempRange = useMemo(() => {
    if (!data?.days.length) return { min: 0, max: 100 };
    const lows = data.days.map((d) => d.lowF);
    const highs = data.days.map((d) => d.highF);
    return { min: Math.min(...lows), max: Math.max(...highs) };
  }, [data]);
  const span = Math.max(1, tempRange.max - tempRange.min);

  const saveZip = (z: string) => {
    const clean = z.trim();
    if (!/^\d{5}$/.test(clean)) return;
    try {
      window.localStorage.setItem(ZIP_KEY, clean);
    } catch {
      // private mode — the ZIP applies for this session only
    }
    setZip(clean);
    setDraftZip("");
  };

  return (
    <div className="relative mx-auto w-full max-w-3xl px-4 pb-10 pt-6">
      <style>{ART_CSS}</style>

      {/* Ambient cosmic glow — follows the condition */}
      <div
        aria-hidden="true"
        className="wx-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] transition-colors duration-1000"
        style={{
          background: `radial-gradient(ellipse 90% 60% at 50% 0%, ${glo} 0%, ${halo} 45%, transparent 70%)`,
        }}
      />

      {/* Header */}
      <div className="mb-2 flex justify-start">
        <BackButton />
      </div>
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-stardust-400">
          The Sky Over Your Day
        </p>
        <h1 className="mt-2 text-3xl font-bold text-star-100">Weather</h1>
        {data && (
          <p className="mt-1 text-sm text-stardust-400">
            {data.location.city}, {data.location.state} {data.location.zip}
            {data.defaulted && " · Home Sky"}
          </p>
        )}
      </div>

      {/* ---------------- LOADING ---------------- */}
      {state === "loading" && (
        <div className="mt-8 space-y-4" aria-label="Loading weather">
          <div className="wx-skeleton mx-auto h-44 w-44 rounded-full" />
          <div className="wx-skeleton mx-auto h-16 w-48 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="wx-skeleton h-20 rounded-2xl" />
            ))}
          </div>
          <div className="wx-skeleton h-40 rounded-2xl" />
        </div>
      )}

      {/* ---------------- STANDBY (graceful, never blank) ---------------- */}
      {state === "standby" && (
        <div className="mt-10">
          <Card className="relative overflow-hidden p-8 text-center">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(120,130,200,0.18) 0%, transparent 70%)",
              }}
            />
            <div className="relative">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-4xl" aria-hidden="true">
                🛰️
              </div>
              <h2 className="mt-4 text-xl font-semibold text-star-100">Signal Lost In The Clouds</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stardust-400">
                Neither the National Weather Service nor the backup feed answered.
                Your sky is still out there — let&apos;s try the signal again.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <Button onClick={() => setNonce((n) => n + 1)}>Try Again</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const el = document.getElementById("wx-zip-setter");
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  Change ZIP
                </Button>
              </div>
            </div>
          </Card>
          <ZipSetterSection id="wx-zip-setter" zip={zip} draft={draftZip} setDraft={setDraftZip} onSave={saveZip} />
        </div>
      )}

      {/* ---------------- READY ---------------- */}
      {state === "ready" && data && (
        <div className="mt-6 space-y-6">
          {/* Hero */}
          <section aria-label="Current conditions" className="text-center">
            {data.current ? (
              <>
                <ConditionArt condition={data.current.condition} isDaytime={data.current.isDaytime} />
                <p className="-mt-2 text-7xl font-bold tracking-tight text-star-100">
                  {data.current.tempF}°
                </p>
                <p className="mt-1 text-lg font-medium text-stardust-200">
                  {data.current.shortForecast || CONDITION_LABEL[data.current.condition]}
                </p>
                <p className="mt-1 text-sm text-stardust-400">
                  Feels Like {data.current.feelsLikeF}°
                  {data.days[0] && (
                    <>
                      {" "}· High {data.days[0].highF}° / Low {data.days[0].lowF}°
                    </>
                  )}
                </p>
                <p className="mt-2 text-[11px] text-stardust-500">
                  {data.live ? "Live" : "Standby"} · {data.source}
                </p>
              </>
            ) : (
              <EmptyState
                title="Current Readings Paused"
                message="The forecast below is still fresh — live station readings will return shortly."
              />
            )}
          </section>

          {/* Stat grid */}
          {data.current && (
            <section aria-label="Details" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Feels Like" value={`${data.current.feelsLikeF}°`} />
              <Stat
                label="Humidity"
                value={data.current.humidity === null ? "—" : `${data.current.humidity}%`}
              />
              <Stat
                label="Wind"
                value={`${data.current.windMph} mph`}
              />
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-stardust-400">
                  Wind Direction
                </p>
                <p className="mt-1 text-lg font-semibold text-star-100">
                  <WindArrow dir={data.current.windDir} /> {data.current.windDir}
                </p>
                {data.current.windGustMph !== null && (
                  <p className="mt-0.5 text-[11px] text-stardust-400">Gusts {data.current.windGustMph} mph</p>
                )}
              </div>
              <Stat
                label="Sunrise"
                value={data.current.sunrise ?? "—"}
              />
              <Stat
                label="Sunset"
                value={data.current.sunset ?? "—"}
              />
              <Stat
                label="Precipitation"
                value={`${data.days[0]?.precipChance ?? 0}%`}
                sub="Chance Today"
              />
              <Stat
                label="Visibility"
                value={data.current.visibilityMi === null ? "—" : `${data.current.visibilityMi} mi`}
              />
            </section>
          )}

          {/* Hourly strip */}
          {data.hourly.length > 0 && (
            <section aria-label="Hourly forecast">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-stardust-400">
                Next Hours
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {data.hourly.map((h, i) => (
                  <div
                    key={`${h.label}-${i}`}
                    className="flex w-16 shrink-0 flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-3"
                  >
                    <p className="text-[10px] font-medium text-stardust-400">{i === 0 ? "Now" : h.label}</p>
                    <span className="my-1.5 text-2xl" aria-hidden="true">
                      {CONDITION_EMOJI[h.condition]}
                    </span>
                    <p className="text-sm font-semibold text-star-100">{h.tempF}°</p>
                    {h.precipChance > 0 && (
                      <p className="mt-0.5 text-[10px] text-sky-300">{h.precipChance}%</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 7-day */}
          {data.days.length > 0 && (
            <section aria-label="7-day outlook">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-stardust-400">
                7-Day Outlook
              </h2>
              <Card className="divide-y divide-white/5 p-2">
                {data.days.map((d) => {
                  const left = ((d.lowF - tempRange.min) / span) * 100;
                  const width = Math.max(6, ((d.highF - d.lowF) / span) * 100);
                  return (
                    <div key={d.date} className="flex items-center gap-3 px-3 py-3">
                      <p className="w-16 shrink-0 text-sm font-medium text-star-100">{d.weekday}</p>
                      <span className="w-7 shrink-0 text-center text-xl" aria-hidden="true" title={d.shortForecast}>
                        {CONDITION_EMOJI[d.condition]}
                      </span>
                      <p className="w-10 shrink-0 text-right text-sm text-stardust-400">{d.lowF}°</p>
                      <div className="relative h-1.5 flex-1 rounded-full bg-white/10" aria-hidden="true">
                        <div
                          className="absolute h-full rounded-full"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            background:
                              "linear-gradient(90deg, rgba(125,211,252,.7), rgba(253,224,71,.8), rgba(251,146,60,.85))",
                          }}
                        />
                      </div>
                      <p className="w-10 shrink-0 text-right text-sm font-semibold text-star-100">{d.highF}°</p>
                      <p className="hidden w-14 shrink-0 text-right text-[11px] text-sky-300 sm:block">
                        {d.precipChance > 0 ? `${d.precipChance}%` : ""}
                      </p>
                    </div>
                  );
                })}
              </Card>
              {data.days[0]?.shortForecast && (
                <p className="mt-3 text-center text-sm leading-relaxed text-stardust-300">
                  {data.days[0].shortForecast}
                </p>
              )}
            </section>
          )}

          {/* Alerts */}
          {data.alerts.length > 0 && (
            <section aria-label="Weather alerts" className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-stardust-400">
                Active Alerts
              </h2>
              {data.alerts.map((a, i) => (
                <AlertCard key={`${a.headline}-${i}`} alert={a} />
              ))}
            </section>
          )}

          {/* ZIP setter */}
          <ZipSetterSection id="wx-zip-setter" zip={zip} draft={draftZip} setDraft={setDraftZip} onSave={saveZip} />

          {/* Contract footer */}
          <p className="text-center text-[11px] leading-relaxed text-stardust-500">
            Pookie isn&apos;t an emergency-alert system — for severe weather, follow official alerts
            from the National Weather Service.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------- ZIP setter ---------------- */

function ZipSetterSection({
  id,
  zip,
  draft,
  setDraft,
  onSave,
}: {
  id: string;
  zip: string;
  draft: string;
  setDraft: (z: string) => void;
  onSave: (z: string) => void;
}) {
  const valid = /^\d{5}$/.test(draft.trim());
  return (
    <section id={id} aria-label="Location" className="scroll-mt-24">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-star-100">Your Sky, Your ZIP</h2>
            <p className="mt-0.5 text-xs text-stardust-400">
              {zip
                ? `Watching ${zip} — shared with the travel module.`
                : "No ZIP saved yet — showing the home sky. Save yours below."}
            </p>
          </div>
          <Badge tone="live">Coarse ZIP Only</Badge>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 5))}
            inputMode="numeric"
            placeholder={zip || "30067"}
            aria-label="ZIP code"
            className="w-32 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-sky-400/50 focus:outline-none"
          />
          <Button disabled={!valid} onClick={() => onSave(draft)}>
            Watch This Sky
          </Button>
        </div>
      </Card>
    </section>
  );
}
