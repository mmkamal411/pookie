"use client";

import { useState } from "react";
import {
  eventDayLabel,
  MINUTIAE_KIND_LABELS,
  ownerLabel,
  todayIso,
  type MinutiaeEvent,
  type MinutiaeKind,
} from "@/lib/school/minutiae";

interface Props {
  events: MinutiaeEvent[];
  childName: string;
  childId: string;
  role: "parent" | "child";
  demo?: boolean;
}

// ---------------------------------------------------------------------------
// Kind icons — small stroke glyphs, one per minutiae kind.
// ---------------------------------------------------------------------------

function KindIcon({ kind }: { kind: MinutiaeKind }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "picture_day":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <circle cx="12" cy="13" r="3.5" />
          <path d="M8 7l1.5-2.5h5L16 7" />
        </svg>
      );
    case "field_trip":
      return (
        <svg {...common}>
          <path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "fundraiser":
      return (
        <svg {...common}>
          <rect x="4" y="9" width="16" height="4" rx="1" />
          <path d="M6 13v7h12v-7M12 9v11M12 9S8 9 7 7s1-3 2.5-2S12 9 12 9zm0 0s4 0 5-2-1-3-2.5-2S12 9 12 9z" />
        </svg>
      );
    case "spirit_week":
      return (
        <svg {...common}>
          <path d="M5 21V4m0 1h12l-2.5 4L17 13H5" />
        </svg>
      );
    case "deadline":
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="7" />
          <path d="M12 10v3l2 2M9 3L5.5 6M15 3l3.5 3" />
        </svg>
      );
    case "concert":
      return (
        <svg {...common}>
          <path d="M9 18V6l10-2v12" />
          <circle cx="7" cy="18" r="2.5" />
          <circle cx="17" cy="16" r="2.5" />
        </svg>
      );
    case "game":
      return (
        <svg {...common}>
          <path d="M8 4h8v5a4 4 0 01-8 0V4zM8 5H4.5a2.5 2.5 0 002.6 4M16 5h3.5a2.5 2.5 0 01-2.6 4M12 13v4m-4 4h8m-8 0l1.5-4m6.5 4L14.5 17" />
        </svg>
      );
    case "performance":
      return (
        <svg {...common}>
          <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
        </svg>
      );
    case "meeting":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0111 0M16 5.5a3 3 0 010 5.8M17.5 14.5a5.5 5.5 0 013 5.5" />
        </svg>
      );
    case "holiday":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19" />
        </svg>
      );
    case "early_release":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3.5 2M4 4l3 3" />
        </svg>
      );
    case "club":
      return (
        <svg {...common}>
          <path d="M12 2.5l8.5 5v9l-8.5 5-8.5-5v-9l8.5-5z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "volunteer":
      return (
        <svg {...common}>
          <path d="M12 20s-7.5-4.5-7.5-10A4.5 4.5 0 0112 6.5 4.5 4.5 0 0119.5 10c0 5.5-7.5 10-7.5 10z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
        </svg>
      );
  }
}

const KIND_TINT: Record<MinutiaeKind, string> = {
  picture_day: "bg-aurum-400/15 text-aurum-200 border-aurum-400/30",
  field_trip: "bg-comet-500/15 text-comet-300 border-comet-500/30",
  fundraiser: "bg-aurum-400/15 text-aurum-200 border-aurum-400/30",
  spirit_week: "bg-comet-500/15 text-comet-300 border-comet-500/30",
  deadline: "bg-halo-300/15 text-halo-200 border-halo-300/40",
  concert: "bg-comet-400/15 text-comet-300 border-comet-400/30",
  game: "bg-comet-500/15 text-comet-300 border-comet-500/30",
  performance: "bg-halo-300/15 text-halo-200 border-halo-300/40",
  meeting: "bg-stardust-500/20 text-stardust-200 border-stardust-500/30",
  holiday: "bg-aurum-400/15 text-aurum-200 border-aurum-400/30",
  early_release: "bg-stardust-500/20 text-stardust-200 border-stardust-500/30",
  club: "bg-comet-400/15 text-comet-300 border-comet-400/30",
  volunteer: "bg-comet-500/15 text-comet-300 border-comet-500/30",
  other: "bg-stardust-500/20 text-stardust-200 border-stardust-500/30",
};

function daysOut(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const today = new Date(todayIso() + "T00:00:00");
  const target = new Date(isoDate + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// ---------------------------------------------------------------------------
// Event card
// ---------------------------------------------------------------------------

function EventCard({
  event,
  childName,
  canAck,
  onAck,
  glow,
}: {
  event: MinutiaeEvent;
  childName: string;
  canAck: boolean;
  onAck: (id: string) => void;
  glow?: boolean;
}) {
  const d = daysOut(event.event_date);
  const dateLine =
    event.kind === "deadline"
      ? d !== null && d < 0
        ? `Was due ${eventDayLabel(event.event_date)} — still open`
        : `Due ${eventDayLabel(event.event_date)}`
      : `Happening ${eventDayLabel(event.event_date)}`;
  return (
    <article
      className={`card-living rounded-2xl border p-4 transition-shadow ${
        glow ? "border-halo-300/50 shadow-halo-md" : "border-comet-600/20"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${KIND_TINT[event.kind]}`}
          aria-hidden
        >
          <KindIcon kind={event.kind} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${KIND_TINT[event.kind]}`}
            >
              {MINUTIAE_KIND_LABELS[event.kind]}
            </span>
            <span className="text-[11px] text-stardust-500">
              {ownerLabel(event.owner, childName)}
            </span>
          </div>
          <h3 className="mt-1.5 font-semibold text-star-100">{event.title}</h3>
          {event.detail && (
            <p className="mt-1 text-sm text-stardust-200">{event.detail}</p>
          )}
          <p
            className={`mt-1.5 text-sm font-medium ${
              event.needs_nudge ? "text-halo-200" : "text-stardust-200"
            }`}
          >
            {dateLine}
          </p>
          {event.prep_note && event.prep_due && !event.ack && (
            <p className="mt-2 rounded-xl bg-nebula-800/40 border border-comet-600/25 px-3 py-2 text-sm text-comet-300">
              <span aria-hidden>🌱 </span>
              {event.prep_note}
            </p>
          )}
          {canAck && !event.ack && (
            <button
              type="button"
              onClick={() => onAck(event.id)}
              className="btn-dapple mt-3 rounded-xl px-4 py-1.5 text-sm font-semibold"
            >
              Got it ✓
            </button>
          )}
          {event.ack && (
            <p className="mt-2 text-sm text-comet-300">
              <span aria-hidden>✓ </span>Acknowledged
              {event.ack_at &&
                ` · ${new Date(event.ack_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}`}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export function MinutiaeCalendar({
  events: initial,
  childName,
  childId,
  role,
  demo = false,
}: Props) {
  const [items, setItems] = useState(initial);

  async function acknowledge(id: string) {
    const optimistic = items.map((e) =>
      e.id === id
        ? {
            ...e,
            ack: true,
            status: "acknowledged" as const,
            needs_nudge: false,
            prep_due: false,
            ack_at: new Date().toISOString(),
          }
        : e,
    );
    setItems(optimistic);
    if (demo) return; // demo: local state only, never calls /api/v1/*
    try {
      const res = await fetch(
        `/api/v1/children/${childId}/school/minutiae/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ack: true }),
        },
      );
      if (!res.ok) throw new Error("ack failed");
      const json = await res.json();
      const updated = json.data.event as MinutiaeEvent;
      setItems((prev) => prev.map((e) => (e.id === id ? updated : e)));
    } catch {
      setItems(initial); // revert on failure
    }
  }

  const canAck = role === "parent";
  const nudges = items.filter((e) => e.needs_nudge);
  const rest = items.filter((e) => !e.needs_nudge && !e.ack);
  const thisWeek = rest.filter((e) => {
    const d = daysOut(e.event_date);
    return d === null || (d >= 0 && d <= 7);
  });
  const comingUp = rest.filter((e) => {
    const d = daysOut(e.event_date);
    return d !== null && d > 7;
  });
  const handled = items.filter((e) => e.ack);

  const weekSorted = [...thisWeek].sort((a, b) =>
    (a.event_date ?? "9999").localeCompare(b.event_date ?? "9999"),
  );

  const cardProps = { childName, canAck, onAck: acknowledge };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <header className="pt-8 text-center">
        <p className="text-sunlit text-sm font-medium tracking-wide">
          ✦ school minutiae ✦
        </p>
        <h1 className="mt-2 text-3xl font-bold text-star-100">
          The little things
        </h1>
        <p className="mt-2 text-stardust-200">
          Picture day, permission slips, spirit week — the small stuff a family
          never wants to miss, for {childName}.
        </p>
      </header>

      {nudges.length > 0 && (
        <section aria-label="Needs your attention" className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-halo-200">
            <span className="halo inline-block h-2.5 w-2.5 rounded-full bg-halo-300" />
            Needs a nudge
          </h2>
          <p className="mt-1 text-sm text-stardust-200">
            Unacknowledged and due within a day — a gentle light on what matters
            most.
          </p>
          <div className="mt-3 space-y-3">
            {nudges.map((e) => (
              <EventCard key={e.id} event={e} {...cardProps} glow />
            ))}
          </div>
        </section>
      )}

      <section aria-label="This week" className="mt-8">
        <h2 className="text-lg font-semibold text-star-100">This week</h2>
        {weekSorted.length === 0 ? (
          <p className="mt-2 text-sm text-stardust-500">
            Nothing on the school calendar this week.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {weekSorted.map((e) => (
              <EventCard key={e.id} event={e} {...cardProps} />
            ))}
          </div>
        )}
      </section>

      {comingUp.length > 0 && (
        <section aria-label="Coming up" className="mt-8">
          <h2 className="text-lg font-semibold text-star-100">Coming up</h2>
          <div className="mt-3 space-y-3">
            {comingUp.map((e) => (
              <EventCard key={e.id} event={e} {...cardProps} />
            ))}
          </div>
        </section>
      )}

      {handled.length > 0 && (
        <details className="mt-8 rounded-2xl border border-comet-600/20 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-stardust-200">
            Handled · {handled.length} acknowledged
          </summary>
          <div className="mt-3 space-y-3">
            {handled.map((e) => (
              <EventCard key={e.id} event={e} {...cardProps} />
            ))}
          </div>
        </details>
      )}

      {items.length === 0 && (
        <div className="mt-12 text-center">
          <div className="firefly mx-auto h-16 w-16" aria-hidden />
          <p className="mt-4 text-stardust-200">
            All clear — nothing on the school calendar.
          </p>
          <p className="mt-1 text-sm text-stardust-500">
            When the school writes, Pookie files the little things here.
          </p>
        </div>
      )}
    </div>
  );
}
