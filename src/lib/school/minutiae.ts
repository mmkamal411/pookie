// W16 school minutiae — client-safe shapes + deterministic lead-time map.
// Backed by the DBA's `school_events` table (010_w16_minutiae.sql).
// No server imports: UI, API payloads, and the extractor stub
// all share this module.

export type MinutiaeKind =
  | "picture_day"
  | "field_trip"
  | "fundraiser"
  | "spirit_week"
  | "deadline"
  | "concert"
  | "game"
  | "performance"
  | "meeting"
  | "holiday"
  | "early_release"
  | "club"
  | "volunteer"
  | "other";

/** Must match the kind CHECK in 010_w16_minutiae.sql exactly. */
export const MINUTIAE_KINDS: MinutiaeKind[] = [
  "picture_day",
  "field_trip",
  "fundraiser",
  "spirit_week",
  "deadline",
  "concert",
  "game",
  "performance",
  "meeting",
  "holiday",
  "early_release",
  "club",
  "volunteer",
  "other",
];

export type MinutiaeOwner = "parent" | "child" | "both";

/** Lifecycle is the ack boolean: false = unacknowledged, true = acknowledged. */
export type MinutiaeStatus = "unacknowledged" | "acknowledged";

export interface MinutiaeEvent {
  id: string;
  child_id: string;
  kind: MinutiaeKind;
  title: string;
  detail: string | null;
  event_date: string | null; // YYYY-MM-DD; null = TBD
  prep_deadline: string | null; // ISO timestamptz — deterministic "do this by"
  reminder_at: string | null; // ISO timestamptz — nudge fires at/after this
  reminder_sent: boolean;
  ack: boolean;
  ack_at: string | null;
  owner: MinutiaeOwner;
  source: "manual" | "extractor";
  /** Derived: ack ? 'acknowledged' : 'unacknowledged'. */
  status: MinutiaeStatus;
  /** Deterministic prep copy for this kind ("lay out the good shirt…"). */
  prep_note: string | null;
  /** Derived: unacknowledged + reminder_at reached (24h-before-due rule). */
  needs_nudge: boolean;
  /** Derived: unacknowledged + prep_deadline reached. */
  prep_due: boolean;
}

/** Friendly label for a YYYY-MM-DD date relative to today. */
export function eventDayLabel(isoDate: string | null): string {
  if (!isoDate) return "date TBD";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + "T00:00:00");
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1 && days <= 6)
    return target.toLocaleDateString("en-US", { weekday: "long" });
  return target.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** YYYY-MM-DD shifted by n days. */
export function isoShift(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Today's date as YYYY-MM-DD (local). */
export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Deterministic lead-time map — the single source of truth for prep timing
// and copy. Same kind + date always yields the same guidance; no LLM in
// the loop. prep_deadline = event_date minus daysBefore ("do this by");
// reminder_at = event_date minus 1 day @ 08:00 (the 24h-before-due nudge).
// ---------------------------------------------------------------------------

interface LeadTimeRule {
  daysBefore: number;
  prep: (title: string, when: string) => string;
}

export const MINUTIAE_LEAD_TIME: Record<MinutiaeKind, LeadTimeRule> = {
  picture_day: {
    daysBefore: 1,
    prep: (t, when) =>
      `Picture day ${when} — lay out the good shirt tonight and check the hair situation. ${t}`,
  },
  field_trip: {
    daysBefore: 7,
    prep: (t, when) =>
      `Field trip ${when} — a full week out: slip signed, bag packed, lunch money ready. ${t}`,
  },
  fundraiser: {
    daysBefore: 3,
    prep: (t, when) =>
      `Fundraiser deadline ${when} — finalize the order forms tonight. ${t}`,
  },
  spirit_week: {
    daysBefore: 3,
    prep: (t, when) =>
      `Spirit week ${when} — costume check three days out: do we have everything, or is there a store run? ${t}`,
  },
  deadline: {
    daysBefore: 1,
    prep: (t, when) => `${t} — due ${when}. Tonight, not tomorrow morning.`,
  },
  concert: {
    daysBefore: 2,
    prep: (t, when) => `${t} ${when} — outfit ready, tickets in the bag.`,
  },
  game: {
    daysBefore: 2,
    prep: (t, when) => `${t} ${when} — jersey, water bottle, ride sorted.`,
  },
  performance: {
    daysBefore: 2,
    prep: (t, when) => `${t} ${when} — costume pressed, call time confirmed.`,
  },
  meeting: {
    daysBefore: 1,
    prep: (t, when) => `${t} ${when} — one night's heads-up.`,
  },
  holiday: {
    daysBefore: 3,
    prep: (_t, when) =>
      `No school ${when} — plan the day now, not the morning of.`,
  },
  early_release: {
    daysBefore: 1,
    prep: (_t, when) =>
      `Early release ${when} — confirm pickup plans tonight so nobody's waiting at the curb.`,
  },
  club: {
    daysBefore: 2,
    prep: (t, when) => `${t} ${when} — gear and dues check two days out.`,
  },
  volunteer: {
    daysBefore: 2,
    prep: (t, when) => `${t} ${when} — confirm the shift and the ride.`,
  },
  other: {
    daysBefore: 1,
    prep: (t, when) =>
      `${t} ${when} — one night's heads-up is all this one needs.`,
  },
};

/**
 * Deterministic dedupe key: `<child_id>:<kind>:<YYYY-MM-DD|tbd>:<slug>`.
 * Tenant-bound by construction (DBA 010); the extractor's ON CONFLICT
 * DO NOTHING collapses repeat emails into one calendar item.
 */
export function buildDedupeKey(
  childId: string,
  kind: MinutiaeKind,
  eventDate: string | null,
  title: string,
): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${childId}:${kind}:${eventDate ?? "tbd"}:${slug}`;
}

/**
 * Compute the writer-side timestamps for an event: prep_deadline (the
 * deterministic "do this by" from the lead-time map) and reminder_at
 * (24h before the event — the parent-nudge trigger).
 */
export function buildPrep(
  kind: MinutiaeKind,
  title: string,
  eventDate: string | null,
): {
  prep_note: string | null;
  prep_deadline: string | null;
  reminder_at: string | null;
} {
  if (!eventDate)
    return { prep_note: null, prep_deadline: null, reminder_at: null };
  const rule = MINUTIAE_LEAD_TIME[kind];
  const when = eventDayLabel(eventDate);
  return {
    prep_note: rule.prep(title, when),
    prep_deadline: `${isoShift(eventDate, -rule.daysBefore)}T19:00:00`,
    reminder_at: `${isoShift(eventDate, -1)}T08:00:00`,
  };
}

/** Nudge rule: unacknowledged + reminder reached (24h-before-due or overdue). */
export function computeNeedsNudge(
  ack: boolean,
  reminderSent: boolean,
  reminderAt: string | null,
): boolean {
  if (ack || reminderSent || !reminderAt) return false;
  return new Date() >= new Date(reminderAt);
}

/** Prep reminder surfaces once prep_deadline is reached (still unacked). */
export function computePrepDue(
  ack: boolean,
  prepDeadline: string | null,
): boolean {
  if (ack || !prepDeadline) return false;
  return new Date() >= new Date(prepDeadline);
}

/** Owner chip label. */
export function ownerLabel(owner: MinutiaeOwner, childName: string): string {
  if (owner === "parent") return "Needs you";
  if (owner === "child") return childName;
  return "Whole family";
}

/** Human kind label for chips. */
export const MINUTIAE_KIND_LABELS: Record<MinutiaeKind, string> = {
  picture_day: "Picture day",
  field_trip: "Field trip",
  fundraiser: "Fundraiser",
  spirit_week: "Spirit week",
  deadline: "Deadline",
  concert: "Concert",
  game: "Game",
  performance: "Performance",
  meeting: "Meeting",
  holiday: "No school",
  early_release: "Early release",
  club: "Club",
  volunteer: "Volunteering",
  other: "School note",
};
