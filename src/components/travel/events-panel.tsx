// W27 Events (REDESIGNED) — vetted listings only.
// Curation policy is always visible; per-event age tags; audience segmented
// control (Grown-up disabled <18); 18+/21+ filtered server-side for <18.
// Until Squad 1's events table lands, the honest "connecting" state shows —
// never invented events (BACKLOG S5-009 anti-criteria).

"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, InfoLine, Sheet } from "@/components/ui";
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

const AGE_TAG_TONE: Record<string, "info" | "warning" | "locked"> = {
  all_ages: "info",
  "13+": "info",
  "18+": "warning",
  "21+": "locked",
};

export function EventsPanel({ isTeen }: { isTeen: boolean }) {
  const [zip, setZip] = useState("");
  const [audience, setAudience] = useState<Audience>("family");
  const [data, setData] = useState<EventsData | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [planFor, setPlanFor] = useState<EventItem | null>(null);

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
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  audience === a
                    ? "border-nova-400/50 bg-nova-500/15 text-star-100"
                    : "border-nova-400/15 bg-nebula-900/50 text-stardust-300"
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
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {["all_ages", "13+", "18+", "21+"].map((t) => (
            <Badge key={t} tone={AGE_TAG_TONE[t]}>
              {t === "all_ages" ? "All ages" : t}
            </Badge>
          ))}
          <span className="ml-1 text-xs text-stardust-400">Events show who they&apos;re for.</span>
        </div>
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
        <div className="space-y-2">
          {data.events.length === 0 && (
            <Card>
              <p className="text-sm text-stardust-300">
                No vetted events nearby right now. Try a nearby ZIP — new listings arrive as the
                catalog connects.
              </p>
            </Card>
          )}
          {data.events.map((e) => (
            <Card key={e.id} padding="sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-star-100">{e.title}</p>
                <Badge tone={AGE_TAG_TONE[e.age_tag ?? "all_ages"] ?? "info"}>
                  {(e.age_tag ?? "all_ages").replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-stardust-400">
                {new Date(e.starts_at).toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {e.venue_name ? ` · ${e.venue_name}` : ""}
                {e.venue_city ? `, ${e.venue_city}` : ""}
              </p>
              {e.description && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-stardust-300">
                  {e.description.slice(0, 220)}
                  {e.description.length > 220 ? "…" : ""}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {e.host_type && (
                  <span className="text-[11px] text-stardust-500">
                    {e.host_type.replace("_", " ")} · verified host
                  </span>
                )}
                {e.source_url && (
                  <a
                    href={e.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-nova-300 underline"
                  >
                    Source
                  </a>
                )}
                <span className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => setPlanFor(e)}>
                  Share my plan →
                </Button>
              </div>
            </Card>
          ))}
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
