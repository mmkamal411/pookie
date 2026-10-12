"use client";

import { useEffect, useState } from "react";
import { orbReveal } from "@/lib/orb/orb-events";
import { pickDailyQuote, type Quote } from "@/lib/daily/quotes";
import { fetchLiveWeather, type WeatherDay } from "@/lib/daily/weather";

const BRIEFING_DATE_KEY = "pookie-briefing-date-v1";

/** The Morning Briefing Ritual — first open of the day, morning hours. */
function isBriefingRitual(now: Date, lastSeenDate: string | null): boolean {
  const h = now.getHours();
  if (h < 5 || h >= 11) return false; // the ritual belongs to the morning
  const today = now.toISOString().slice(0, 10);
  return lastSeenDate !== today;
}

function greetingForHour(h: number): string {
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function WeatherGlyph({ icon }: { icon: WeatherDay["icon"] }) {
  // Soft neon weather glyphs — instrument-readout style.
  const cls = "size-5";
  switch (icon) {
    case "sun":
      return (
        <svg viewBox="0 0 24 24" className={`${cls} text-amber-300`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19" strokeLinecap="round" />
        </svg>
      );
    case "cloud-sun":
      return (
        <svg viewBox="0 0 24 24" className={`${cls} text-amber-200`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 2.5V4M2.5 8H4M4.2 4.2l1 1M11.8 4.2l-1 1M9 20h9a3.5 3.5 0 0 0 .6-6.95A5 5 0 0 0 9 14.5 3.2 3.2 0 0 0 9 20Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 24 24" className={`${cls} text-stardust-300`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path d="M7 19h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.2 12.6 3.5 3.5 0 0 0 7 19Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "rain":
      return (
        <svg viewBox="0 0 24 24" className={`${cls} text-sky-300`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path d="M7 15h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.2 8.6 3.5 3.5 0 0 0 7 15Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 18v2M12 18v2M16 18v2" strokeLinecap="round" />
        </svg>
      );
  }
}

/**
 * Mission Briefing — the home tab hero, ported from d-dash's dashboard hero.
 * Time-of-day greeting, date line, the daily quote (expandable), and the
 * 3-day weather strip (expands to 5-day). Restyled as ship instruments:
 * glass pane, neon hairlines, readout typography.
 */
export function MissionBriefing({
  childName,
  schoolName,
  gradeLevel,
  attentionCount,
  urgentCount,
  classCount,
}: {
  childName: string;
  schoolName: string | null;
  gradeLevel: string | null;
  attentionCount: number;
  urgentCount: number;
  classCount: number;
}) {
  const [greeting, setGreeting] = useState("Hello");
  const [dateLine, setDateLine] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [isRitual, setIsRitual] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const now = new Date();
      setGreeting(greetingForHour(now.getHours()));
      setDateLine(
        new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(now)
      );
      setQuote(pickDailyQuote());
      // Squad Oracle: the Morning Briefing Ritual. First morning open of
      // the day gets the full ceremony — the orb delivers the day.
      let lastSeen: string | null = null;
      try {
        lastSeen = window.localStorage.getItem(BRIEFING_DATE_KEY);
      } catch {
        /* best-effort */
      }
      if (isBriefingRitual(now, lastSeen)) {
        setIsRitual(true);
        try {
          window.localStorage.setItem(BRIEFING_DATE_KEY, now.toISOString().slice(0, 10));
        } catch {
          /* best-effort */
        }
        orbReveal("morning briefing ritual");
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let live = true;
    fetchLiveWeather().then((days) => {
      if (live) setWeather(days);
    });
    return () => {
      live = false;
    };
  }, []);

  const schoolLine = [schoolName, gradeLevel ? `Grade ${gradeLevel}` : null]
    .filter(Boolean)
    .join(" · ");

  const shown = weatherOpen ? weather : weather.slice(0, 3);

  return (
    <header>
      <div className="animate-bloom flex items-center gap-4">
        <p className="text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">
          Home · mission briefing
        </p>
      </div>

      <p
        className="animate-bloom mt-4 text-xs font-medium tracking-[0.18em] text-stardust-500 capitalize"
        style={{ animationDelay: "0.05s" }}
      >
        {dateLine || " "}
      </p>
      <h1
        className="text-sunlit animate-bloom mt-1 text-3xl font-semibold tracking-tight sm:text-4xl"
        style={{ animationDelay: "0.08s" }}
      >
        {greeting}, {childName}.
      </h1>
      <p
        className="animate-bloom mt-3 max-w-xl leading-relaxed text-stardust-300"
        style={{ animationDelay: "0.12s" }}
      >
        {schoolLine && <>{schoolLine} · </>}
        Goal: <span className="font-semibold text-star-100">90%+ in every class</span>
        {classCount === 0 ? (
          <> · the board is quiet — no classes on the instruments yet</>
        ) : attentionCount > 0 ? (
          <>
            {" "}· {attentionCount} {attentionCount === 1 ? "class" : "classes"} getting
            extra love
          </>
        ) : (
          <> · every class at the goal</>
        )}
        {urgentCount > 0 && (
          <>
            {" "}· {urgentCount} {urgentCount === 1 ? "item" : "items"} due soon
          </>
        )}
        .
      </p>

      {/* The Morning Briefing Ritual — the orb's daily transmission.
          Overnight changes, today's mission, what needs attention.
          Warm, sci-fi, brief. The reason to open the app every morning. */}
      {isRitual && (
        <section
          className="animate-bloom mt-5 overflow-hidden rounded-3xl border border-nova-400/25 bg-nebula-900/60"
          style={{
            animationDelay: "0.14s",
            boxShadow: "0 0 32px rgb(96 165 250 / 0.15), inset 0 1px 0 rgb(255 255 255 / 0.06)",
          }}
          aria-label="Morning briefing ritual"
        >
          <div className="flex items-center gap-3 border-b border-nova-400/15 px-5 py-3">
            <span aria-hidden="true" className="inline-block h-2 w-2 animate-pulse rounded-full bg-nova-400" />
            <p className="text-xs font-medium tracking-[0.22em] text-nova-300 capitalize">
              Overnight transmission · {childName}&apos;s day
            </p>
          </div>
          <div className="space-y-3 px-5 py-4 text-[15px] leading-relaxed text-star-100">
            <p>
              {urgentCount > 0 ? (
                <>
                  <span className="font-semibold text-amber-300">Today&apos;s mission:</span>{" "}
                  {urgentCount} {urgentCount === 1 ? "item" : "items"} due soon — handle
                  those first and the day is yours.
                </>
              ) : (
                <>
                  <span className="font-semibold text-emerald-300">Today&apos;s mission:</span>{" "}
                  nothing due, nothing overdue — a clear runway. Perfect day to get ahead.
                </>
              )}
            </p>
            <p className="text-stardust-300">
              {classCount === 0 ? (
                <>The instruments are quiet — school data syncs in the background.</>
              ) : attentionCount > 0 ? (
                <>
                  {attentionCount} {attentionCount === 1 ? "class" : "classes"} below 80 —
                  that&apos;s where your firepower goes today.
                </>
              ) : (
                <>Every class at the 90 goal. The orb is proud of you, Captain.</>
              )}
            </p>
            <p className="text-sm text-stardust-400 italic">
              Pookie watched the skies overnight. Fly well today.
            </p>
          </div>
        </section>
      )}

      {/* Quote of the day — d-dash's beloved briefing quote, as an instrument readout */}
      {quote && (
        <figure
          className="holo-panel animate-bloom mt-5 px-5 py-4"
          style={{ animationDelay: "0.16s" }}
        >
          <blockquote className="text-[15px] leading-relaxed text-star-100 italic">
            &ldquo;{quote.text}&rdquo;
          </blockquote>
          <figcaption className="mt-2 text-xs font-medium tracking-[0.14em] text-nova-300 capitalize">
            {quote.source} · today&apos;s fuel
          </figcaption>
        </figure>
      )}

      {/* Weather strip — 3-day glance, expands to 5-day */}
      {weather.length > 0 && (
        <div className="animate-bloom mt-4" style={{ animationDelay: "0.2s" }}>
          <button
            type="button"
            onClick={() => setWeatherOpen((o) => !o)}
            aria-expanded={weatherOpen}
            aria-label={weatherOpen ? "Collapse 5-day forecast" : "Expand 5-day forecast"}
            className="w-full text-left"
          >
            <div className={`grid gap-2 ${weatherOpen ? "grid-cols-5" : "grid-cols-3"}`}>
              {shown.map((d) => (
                <div
                  key={d.day}
                  className="flex flex-col items-center gap-1 rounded-xl border border-nova-400/15 bg-nebula-800/30 px-2 py-3"
                  title={d.label}
                >
                  <span className="text-[11px] font-medium tracking-wide text-stardust-400 capitalize">
                    {d.day}
                  </span>
                  <WeatherGlyph icon={d.icon} />
                  <span className="readout text-sm font-semibold text-star-100 tabular-nums">
                    {d.temp}°
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-nova-300">
              {weatherOpen ? "Show less ▴" : "5-day outlook ▾"}
            </p>
          </button>
        </div>
      )}
    </header>
  );
}
