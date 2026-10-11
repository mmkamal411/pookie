// W16 school minutiae — framework-free business logic over the DBA's
// `school_events` table (010_w16_minutiae.sql).
// Handlers are thin: validate → resolve tenant → call service → audit.
// Reads use the user-JWT server client (RLS enforces tenancy); the
// ingestion path uses supabaseAdmin (service_role) with an explicit child_id
// and upserts ON CONFLICT (dedupe_key) DO NOTHING.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ErrorCodes, failWith } from "@/server/errors";
import {
  buildDedupeKey,
  buildPrep,
  computeNeedsNudge,
  computePrepDue,
  MINUTIAE_KINDS,
  type MinutiaeEvent,
  type MinutiaeKind,
  type MinutiaeOwner,
} from "@/lib/school/minutiae";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const kindEnum = z.enum(MINUTIAE_KINDS);
const ownerEnum = z.enum(["parent", "child", "both"] as const);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

export const minutiaeCreateSchema = z.object({
  kind: kindEnum,
  title: z.string().min(1).max(200),
  detail: z.string().max(1000).optional(),
  event_date: isoDate.nullable().optional(),
  owner: ownerEnum.default("parent"),
});

export const minutiaePatchSchema = z.object({
  ack: z.boolean().optional(),
  kind: kindEnum.optional(),
  title: z.string().min(1).max(200).optional(),
  detail: z.string().max(1000).nullable().optional(),
  event_date: isoDate.nullable().optional(),
  owner: ownerEnum.optional(),
});

export const minutiaeIngestSchema = z.object({
  events: z
    .array(
      z.object({
        kind: kindEnum,
        title: z.string().min(1).max(200),
        detail: z.string().max(1000).optional(),
        event_date: isoDate.nullable().optional(),
        owner: ownerEnum.default("parent"),
        dedupe_key: z.string().min(1).max(300).optional(),
        source_message_id: z.string().max(300).optional(),
      }),
    )
    .min(1)
    .max(200),
});

// ---------------------------------------------------------------------------
// Row → API shape (adds derived lifecycle + escalation flags)
// ---------------------------------------------------------------------------

type SchoolEventRow = {
  id: string;
  child_id: string;
  kind: MinutiaeKind;
  title: string;
  detail: string | null;
  event_date: string | null;
  prep_deadline: string | null;
  reminder_at: string | null;
  reminder_sent: boolean;
  ack: boolean;
  ack_at: string | null;
  owner: MinutiaeOwner;
  source: "manual" | "extractor";
};

const EVENT_COLUMNS =
  "id,child_id,kind,title,detail,event_date,prep_deadline,reminder_at,reminder_sent,ack,ack_at,owner,source";

function toEvent(row: SchoolEventRow): MinutiaeEvent {
  const prep = buildPrep(row.kind, row.title, row.event_date);
  return {
    id: row.id,
    child_id: row.child_id,
    kind: row.kind,
    title: row.title,
    detail: row.detail,
    event_date: row.event_date,
    prep_deadline: row.prep_deadline,
    reminder_at: row.reminder_at,
    reminder_sent: row.reminder_sent,
    ack: row.ack,
    ack_at: row.ack_at,
    owner: row.owner,
    source: row.source,
    status: row.ack ? "acknowledged" : "unacknowledged",
    prep_note: prep.prep_note,
    needs_nudge: computeNeedsNudge(row.ack, row.reminder_sent, row.reminder_at),
    prep_due: computePrepDue(row.ack, row.prep_deadline),
  };
}

// ---------------------------------------------------------------------------
// Reads — user JWT; RLS (current_child_ids()) enforces tenancy
// ---------------------------------------------------------------------------

/** Full minutiae calendar for a child, soonest first (TBD last). */
export async function getMinutiaeCalendar(
  childId: string,
): Promise<MinutiaeEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_events")
    .select(EVENT_COLUMNS)
    .eq("child_id", childId)
    .order("event_date", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) {
    console.error("[minutiae] db error:", error.message);
    failWith(ErrorCodes.INTERNAL);
  }
  return ((data ?? []) as SchoolEventRow[]).map(toEvent);
}

/** One event by id (tenant-scoped via RLS; 404 on miss). */
export async function getMinutiaeEvent(
  childId: string,
  eventId: string,
): Promise<MinutiaeEvent> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_events")
    .select(EVENT_COLUMNS)
    .eq("child_id", childId)
    .eq("id", eventId)
    .maybeSingle();
  if (error) {
    console.error("[minutiae] db error:", error.message);
    failWith(ErrorCodes.INTERNAL);
  }
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return toEvent(data as SchoolEventRow);
}

// ---------------------------------------------------------------------------
// Writes — parent role asserted by the route before calling
// ---------------------------------------------------------------------------

export async function createMinutiaeEvent(
  childId: string,
  input: z.infer<typeof minutiaeCreateSchema>,
): Promise<MinutiaeEvent> {
  const eventDate = input.event_date ?? null;
  const { prep_deadline, reminder_at } = buildPrep(
    input.kind,
    input.title,
    eventDate,
  );
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_events")
    .insert({
      child_id: childId,
      kind: input.kind,
      title: input.title,
      detail: input.detail ?? null,
      event_date: eventDate,
      prep_deadline,
      reminder_at,
      owner: input.owner,
      source: "manual",
      dedupe_key: buildDedupeKey(childId, input.kind, eventDate, input.title),
    })
    .select(EVENT_COLUMNS)
    .single();
  if (error) {
    // Manual rows can collide with extractor rows on the dedupe key.
    if (error.code === "23505") failWith(ErrorCodes.CONFLICT);
    console.error("[minutiae] db error:", error.message);
    failWith(ErrorCodes.INTERNAL);
  }
  return toEvent(data as SchoolEventRow);
}

export async function patchMinutiaeEvent(
  childId: string,
  eventId: string,
  userId: string,
  input: z.infer<typeof minutiaePatchSchema>,
): Promise<MinutiaeEvent> {
  const existing = await getMinutiaeEvent(childId, eventId);

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.detail !== undefined) patch.detail = input.detail;
  if (input.owner !== undefined) patch.owner = input.owner;
  if (input.event_date !== undefined) patch.event_date = input.event_date;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.ack !== undefined) {
    patch.ack = input.ack;
    patch.ack_at = input.ack ? new Date().toISOString() : null;
    patch.ack_by = input.ack ? userId : null;
  }
  // Recompute deterministic prep timestamps when the date/kind/title moves.
  if (
    input.event_date !== undefined ||
    input.kind !== undefined ||
    input.title !== undefined
  ) {
    const { prep_deadline, reminder_at } = buildPrep(
      (input.kind ?? existing.kind) as MinutiaeKind,
      (input.title ?? existing.title) as string,
      (input.event_date !== undefined
        ? input.event_date
        : existing.event_date) as string | null,
    );
    patch.prep_deadline = prep_deadline;
    patch.reminder_at = reminder_at;
    // Re-opening the timeline resets the reminder so it can fire again.
    patch.reminder_sent = false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("school_events")
    .update(patch)
    .eq("child_id", childId)
    .eq("id", eventId)
    .select(EVENT_COLUMNS)
    .single();
  if (error) {
    console.error("[minutiae] db error:", error.message);
    failWith(ErrorCodes.INTERNAL);
  }
  return toEvent(data as SchoolEventRow);
}

// ---------------------------------------------------------------------------
// Ingestion — service_role upsert, ON CONFLICT (dedupe_key) DO NOTHING.
// Called by the parent-facing ingest route AND by W1's extractor pipeline.
// ---------------------------------------------------------------------------

export async function ingestMinutiaeEvents(
  childId: string,
  events: z.infer<typeof minutiaeIngestSchema>["events"],
): Promise<{ inserted: number; skipped_dupe: number }> {
  const rows = events.map((e) => {
    const eventDate = e.event_date ?? null;
    const { prep_deadline, reminder_at } = buildPrep(
      e.kind,
      e.title,
      eventDate,
    );
    return {
      child_id: childId,
      kind: e.kind,
      title: e.title,
      detail: e.detail ?? null,
      event_date: eventDate,
      prep_deadline,
      reminder_at,
      owner: e.owner,
      source: "extractor",
      source_message_id: e.source_message_id ?? null,
      dedupe_key:
        e.dedupe_key ?? buildDedupeKey(childId, e.kind, eventDate, e.title),
    };
  });
  const { data, error } = await supabaseAdmin
    .from("school_events")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error("[minutiae] ingest error:", error.message);
    failWith(ErrorCodes.INTERNAL);
  }
  const inserted = (data ?? []).length;
  return { inserted, skipped_dupe: rows.length - inserted };
}

// ---------------------------------------------------------------------------
// EXTRACTOR HOOK — owned by W1's school-comms pipeline.
// The real NLP extractor (teacher/school email → dated calendar events)
// lives with W1's team. This stub documents the interface contract; the
// pipeline calls extractMinutiaeFromMessage() per inbound message and
// writes the results via ingestMinutiaeEvents() above, which dedupes on
// dedupe_key — five emails about the same picture day become one item.
// ---------------------------------------------------------------------------

/** An inbound school/teacher message handed to the extractor. */
export interface SchoolCommsMessage {
  /** Comms-pipeline message id (claim column, text in this schema). */
  message_id: string;
  child_id: string;
  subject: string | null;
  body: string;
  sent_at: string | null;
  class_slug: string | null;
}

/** One extracted calendar candidate — dedupe_key must be deterministic. */
export interface ExtractedMinutiaeCandidate {
  kind: MinutiaeKind;
  title: string;
  detail?: string;
  /** The date the MESSAGE says, verified against raw text (null = TBD). */
  event_date: string | null;
  owner: MinutiaeOwner;
  /** Deterministic: `<child_id>:<kind>:<YYYY-MM-DD|tbd>:<slug(title)>`. */
  dedupe_key: string;
}

/**
 * W1 stub — returns no candidates. The real extractor is implemented by
 * W1's school-comms pipeline; when it lands, this function gains the NLP
 * and callers are unchanged (the seam is the return type, not the body).
 */
export function extractMinutiaeFromMessage(
  msg: SchoolCommsMessage,
): ExtractedMinutiaeCandidate[] {
  void msg; // W1 owns the real extractor — stub returns [] so the seam typechecks.
  return [];
}

/**
 * Pipeline entry point: extract candidates from a message, then ingest.
 * W1's worker calls this per inbound message. Idempotent by construction.
 */
export async function extractAndIngestMinutiae(
  msg: SchoolCommsMessage,
): Promise<{ inserted: number; skipped_dupe: number }> {
  const candidates = extractMinutiaeFromMessage(msg);
  if (candidates.length === 0) return { inserted: 0, skipped_dupe: 0 };
  return ingestMinutiaeEvents(
    msg.child_id,
    candidates.map((c) => ({
      kind: c.kind,
      title: c.title,
      detail: c.detail,
      event_date: c.event_date,
      owner: c.owner,
      dedupe_key: c.dedupe_key,
      source_message_id: msg.message_id,
    })),
  );
}
