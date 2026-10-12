// W27 Events — happenings on the horizon.
// Vetted listings only. Curation policy is always visible; per-event age
// tags; audience segmented control (Grown-up disabled <18); 18+/21+
// filtered server-side for <18. Until Squad 1's events table lands, the
// honest "connecting" state shows — never invented events.

"use client";

import { useEffect, useState } from "react";
import { Button, Card, InfoLine, Sheet } from "@/components/ui";
import {
  ErrorCard,
  InitializingCard,
  LoadingRows,
  ZipGate,
  api,
  readStoredZip,
  storeZip,
} from "./travel-shared";

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  venue_name: string | null;
  venue_city: string | null;
  age_tag: string | null;
  host_type: string | null;
  source_url: string | null;
}
interface EventsData {
  status: string;
  events: EventItem[];
  audience: string;
  message?: string;
  curation_policy?: string;
}

type Audience = "family" | "teen" | "grown_up";

const AGE_TAG_STYLE: Record<string, string> = {
  all_ages: "border-cyan-300/30 bg-cyan-400/10 text-cyan-200",
  "13+": "border-teal-300/30 bg-teal-400/10 text-teal-200",
  "18+": "border-amber-300/30 bg-amber-400/10 text-amber-200",
  "21+": "border-red-300/30 bg-red-400/10 text-red-200",
};

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateBadge(iso: string): { month: string; day: string; weekday: string; time: string } {
  const d = new Date(iso);
  return {
    month: MONTH_SHORT[d.getMonth()],
    day: String(d.getDate()),
    weekday: DAY_SHORT[d.getDay()],
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function countdown(iso: string): string | null {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return null;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `In ${days}d ${hours}h`;
  if (hours > 0) return `In ${hours}h`;
  const mins = Math.floor(ms / 60000);
  return mins > 1 ? `In ${mins} min` : "Starting soon";
}

export function EventsPanel({ isTeen }: { isTeen: boolean }) {
  const [zip, setZip] = useState("");
  const [audience, setAudience] = useState<Audience>("family");
  const [data, setData] = useState<EventsData | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [planFor, setPlanFor] = useState<EventItem | null>(null);
  // FR-SAFETY-007: Explorer Setup gate for 13-15 year olds
  const [gateStatus, setGateStatus] = useState<{ gateRequired: boolean; gateCompleted: boolean } | null>(null);

  useEffect(() => {
    setZip(readStoredZip());
    // Check Explorer Setup gate for teens
    if (isTeen) {
      api<{ gateRequired: boolean; gateCompleted: boolean }>("/api/v1/safety/explorer-setup")
        .then(setGateStatus)
        .catch(() => setGateStatus({ gateRequired: false, gateCompleted: true }));
    }
  }, [isTeen]);

  useEffect(() => {
    if (!zip) {
      setState("idle");
      return;
    }
    let cancelled = false;
    setState("loading");
    api<EventsData>(`/api/v1/travel/events?zip=${zip}&audience=${audience}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setState("loaded");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [zip, audience, nonce]);

  return (
    <div className="space-y-4">
      {/* Happenings header */}
      <section className="holo-panel led-strip-teal px-5 py-5">
        <p className="text-[10px] font-bold tracking-[0.2em] text-cyan-200/70 uppercase">
          Happenings
        </p>
        <h2 className="mt-1 text-xl font-bold text-star-100">What&apos;s on the horizon?</h2>
        <p className="mt-0.5 text-sm text-stardust-300">
          Every event vetted — public venues and verified hosts only. Never a guess, never a DM.
        </p>
      </section>

      <InfoLine tone="teal" icon="🛡️">
        <strong>Every event here is vetted.</strong> Pookie only lists public venues, schools,
        city events, and verified hosts — never private homes or &ldquo;DM for address&rdquo;
        meetups.
      </InfoLine>

      <Card>
        <p className="text-sm font-medium text-star-100">Who&apos;s this list for?</p>
        <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Audience">
          {(["family", "teen", "grown_up"] as Audience[]).map((a) => {
            const disabled = a === "grown_up" && isTeen;
            return (
              <button
                key={a}
                role="radio"
                aria-checked={audience === a}
                disabled={disabled}
                onClick={() => setAudience(a)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  audience === a
                    ? "border-nova-400/50 bg-nova-500/15 text-star-100 shadow-glow-sm"
                    : "border-nova-400/15 bg-nebula-900/50 text-stardust-300 hover:border-nova-400/30"
                }`}
              >
                {a === "family" ? "Family" : a === "teen" ? "Teen" : "Grown-up"}
              </button>
            );
          })}
        </div>
        {isTeen && (
          <p className="mt-2 text-xs text-stardust-400">
            Grown-up events are for 18+ — your list shows Family and Teen.
          </p>
        )}
      </Card>

      <ZipGate
        value={zip}
        label="What area should we check?"
        onChange={(z) => {
          setZip(z);
          storeZip(z);
        }}
      />

      {state === "idle" && (
        <InitializingCard
          title="Add your ZIP for events"
          message="Real vetted listings from municipal calendars and verified hosts — with age tags on every event."
        />
      )}
      {state === "loading" && <LoadingRows rows={4} />}
      {state === "error" && <ErrorCard message={error} onRetry={() => setNonce((n) => n + 1)} />}

      {state === "loaded" && data?.status === "service_initializing" && (
        <InitializingCard
          title="The events catalog is connecting"
          message={
            data.message ??
            "Municipal calendars (Cobb Parks & Rec, Marietta) are being wired up. Check back soon."
          }
        />
      )}

      {state === "loaded" && data?.status === "ok" && (
        <div className="space-y-3">
          {data.events.length === 0 && (
            <Card>
              <p className="text-sm text-stardust-300">
                Nothing on the horizon right now. Try a nearby ZIP — new listings arrive as the
                catalog connects.
              </p>
            </Card>
          )}
          {data.events.map((e, i) => {
            const badge = dateBadge(e.starts_at);
            const cd = countdown(e.starts_at);
            const tag = e.age_tag ?? "all_ages";
            return (
              <article
                key={e.id}
                className="card-living animate-rise group flex gap-4 overflow-hidden rounded-3xl p-4"
                style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}
              >
                {/* Date badge — tear-off calendar */}
                <div className="flex w-[68px] shrink-0 flex-col items-center overflow-hidden rounded-2xl border border-nova-400/25 bg-gradient-to-b from-nebula-800/90 to-nebula-950/95 shadow-glow-sm">
                  <span className="w-full bg-nova-500/25 py-1 text-center text-[10px] font-bold tracking-widest text-nova-200 uppercase">
                    {badge.month}
                  </span>
                  <span className="py-1 text-2xl font-black text-star-100">{badge.day}</span>
                  <span className="pb-1.5 text-[10px] font-semibold text-stardust-400">
                    {badge.weekday} · {badge.time}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[15px] font-bold leading-snug text-star-100">{e.title}</h3>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${AGE_TAG_STYLE[tag] ?? AGE_TAG_STYLE.all_ages}`}
                    >
                      {tag === "all_ages" ? "All ages" : tag}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-stardust-400">
                    {e.venue_name && (
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden="true">📍</span>
                        <span className="font-medium text-stardust-300">{e.venue_name}</span>
                      </span>
                    )}
                    {e.venue_city && <span>· {e.venue_city}</span>}
                  </p>
                  {e.description && (
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-stardust-300">
                      {e.description}
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {cd && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-comet-400/10 px-2.5 py-1 text-[11px] font-bold text-comet-200">
                        <span aria-hidden="true">⏳</span> {cd}
                      </span>
                    )}
                    {e.host_type && (
                      <span className="text-[11px] text-stardust-500">
                        {e.host_type.replace("_", " ")} · verified host
                      </span>
                    )}
                    <span className="flex-1" />
                    {isTeen && gateStatus?.gateRequired && !gateStatus.gateCompleted ? (
                      <Button size="sm" variant="ghost" onClick={() => {
                        window.location.href = "/safety/explorer-setup";
                      }}>
                        Complete Safety Setup →
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setPlanFor(e)}>
                        Share my plan →
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {data.curation_policy && (
            <p className="text-[11px] leading-relaxed text-stardust-500">{data.curation_policy}</p>
          )}
        </div>
      )}

      <Sheet
        open={planFor !== null}
        onClose={() => setPlanFor(null)}
        title="Share my plan"
        subtitle="Tell a trusted adult where you're going."
      >
        {planFor && (
          <div className="space-y-3">
            <p className="text-sm text-star-100">{planFor.title}</p>
            <p className="text-xs text-stardust-400">
              {new Date(planFor.starts_at).toLocaleString()}
              {planFor.venue_name ? ` · ${planFor.venue_name}` : ""}
            </p>
            <InfoLine>
              Full share-my-plan (trusted-adult picker, check-in timers) arrives with Squad
              1&apos;s outing plans. For now: copy the details and text them to your trusted
              adult.
            </InfoLine>
            <Button
              onClick={() => {
                const text = `${planFor.title} — ${new Date(planFor.starts_at).toLocaleString()}${planFor.venue_name ? ` at ${planFor.venue_name}` : ""}`;
                void navigator.clipboard?.writeText(text).catch(() => {});
              }}
            >
              Copy plan details
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
