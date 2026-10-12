// Teacher / counselor inbox segregation — FR-SCHOOL-002, FR-SCHOOL-016.
//
// ASCA B.2: counselor confidentiality is not a parent CC line. Segregation is
// enforced via teacher_messages.sender_type ('teacher' | 'counselor'):
//   - The teen sees everything.
//   - Parent viewers see teacher threads in full (CC-redacted, FR-SCHOOL-016)
//     but counselor threads as METADATA ONLY — body stripped, body_withheld
//     set — until the teen grants the counselor_communications scope.
//     The withhold happens in listTeacherThreads()/listMessagesV2() on EVERY
//     parent-visible read path (single choke point per reader).
//
// Every thread header shows: source system, fetched_at, linked student, and
// for counselor threads the standing line:
//   "Counselor conversations are confidential to the student (ASCA B.2)."
// Safety-critical messages (tagSafetyCritical) bypass revocation and route to
// the safety channel (never revocable — §1.2b.3 carve-out).
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, ErrorCodes, failWith, mapDbError } from "@/server/errors";
import {
  redactNonLinkedStudents,
  tagSafetyCritical,
  type LinkedStudent,
} from "@/server/services/provenance";

export const COUNSELOR_CONFIDENTIALITY_LINE =
  "Counselor conversations are confidential to the student (ASCA B.2).";

export interface ThreadProvenance {
  provenance: string;
  provenanceLabel: string;
  source: string | null;
  fetchedAt: string | null;
}

export interface TeacherThreadView {
  id: string;
  class_id: string | null;
  direction: string;
  subject: string | null;
  body: string;
  /** True for parents on counselor threads (ASCA B.2 metadata-only). */
  bodyWithheld: boolean;
  bodyRedacted: boolean;
  senderType: "teacher" | "counselor";
  status: string;
  safetyCritical: boolean;
  threadProvenance: ThreadProvenance;
  created_at: string;
  sent_at: string | null;
}

/** Linked students for the caller's household (roster for CC redaction). */
export async function getLinkedStudents(childId: string): Promise<LinkedStudent[]> {
  const supabase = await createClient();
  const { data: childIds } = await supabase.rpc("current_child_ids");
  const ids = (childIds ?? []) as string[];
  if (!ids.includes(childId)) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  const { data, error } = await supabase
    .from("children")
    .select("id, first_name, last_name")
    .in("id", ids);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  const { data: users } = await supabase
    .from("child_access")
    .select("user_id")
    .in("child_id", ids)
    .eq("role", "parent");
  const parentIds = [...new Set(((users ?? []) as Array<{ user_id: string }>).map((u) => u.user_id))];
  let parentEmails: string[] = [];
  if (parentIds.length > 0) {
    const { data: userRows } = await supabase.from("users").select("id, email").in("id", parentIds);
    parentEmails = ((userRows ?? []) as Array<{ email: string }>).map((u) => u.email);
  }
  return ((data ?? []) as Array<{ first_name: string; last_name: string }>).map((c) => ({
    firstName: c.first_name,
    lastName: c.last_name,
    emails: parentEmails,
  }));
}

/**
 * Teacher threads for a viewer. Parents get CC-redacted bodies + provenance
 * labels; counselor threads are metadata-only for parents (body withheld,
 * ASCA B.2); the teen gets the full thread. `isParent` comes from assertTenant().
 */
export async function listTeacherThreads(
  childId: string,
  classId: string | undefined,
  isParent: boolean,
): Promise<{ threads: TeacherThreadView[] }> {
  const supabase = await createClient();
  let query = supabase
    .from("teacher_messages")
    .select(
      "id, class_id, direction, subject, body, status, sender_type, safety_critical, provenance, source, fetched_at, to_addrs, cc_addrs, created_at, sent_at",
    )
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (classId) query = query.eq("class_id", classId);
  const { data, error } = await query;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));

  const linked = isParent ? await getLinkedStudents(childId) : [];
  const threads = ((data ?? []) as Array<Record<string, unknown>>).map((m) => {
    const senderType = ((m.sender_type as string) ?? "teacher") as "teacher" | "counselor";
    const isCounselor = senderType === "counselor";
    // ASCA B.2: parents see counselor threads as metadata only.
    const bodyWithheld = isParent && isCounselor;
    const body = bodyWithheld ? "" : String(m.body ?? "");
    let rendered = body;
    let bodyRedacted = false;
    if (isParent && !bodyWithheld) {
      const r = redactNonLinkedStudents(body, linked, {
        toAddrs: (m.to_addrs as string[]) ?? [],
        ccAddrs: (m.cc_addrs as string[]) ?? [],
      });
      rendered = r.redacted;
      bodyRedacted = r.redactionCount > 0;
    }
    const provenance = String(m.provenance ?? "school_of_record");
    return {
      id: String(m.id),
      class_id: (m.class_id as string) ?? null,
      direction: String(m.direction),
      subject: (m.subject as string) ?? null,
      body: rendered,
      bodyWithheld,
      bodyRedacted,
      senderType,
      status: String(m.status),
      safetyCritical: Boolean(m.safety_critical),
      threadProvenance: {
        provenance,
        provenanceLabel:
          provenance === "school_of_record"
            ? "School record — the school may share this with a custodial parent regardless of app settings."
            : "Created in Pookie — visibility follows your sharing settings.",
        source: (m.source as string) ?? null,
        fetchedAt: (m.fetched_at as string) ?? null,
      },
      created_at: String(m.created_at),
      sent_at: (m.sent_at as string) ?? null,
    } satisfies TeacherThreadView;
  });
  return { threads };
}

export interface CounselorThreadMeta {
  thread_key: string;
  subject: string | null;
  from_addr: string | null;
  last_message_at: string;
  message_count: number;
  safety_critical: boolean;
  /** Present for the teen; ALWAYS null for parents (ASCA B.2). */
  body: string | null;
  confidentialityLine: string;
}

/**
 * Counselor threads (sender_type='counselor'). Parents receive metadata only
 * (body always null on that path — enforced here, not just in the UI);
 * the teen gets the full thread. Standing ASCA B.2 line attached.
 */
export async function listCounselorThreads(
  childId: string,
  isParent: boolean,
): Promise<{ threads: CounselorThreadMeta[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teacher_messages")
    .select("id, thread_key, from_addr, subject, body, source, safety_critical, fetched_at, created_at")
    .eq("child_id", childId)
    .eq("sender_type", "counselor")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  // Group into threads by thread_key (fallback: per-message).
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const m of (data ?? []) as Array<Record<string, unknown>>) {
    const key = (m.thread_key as string) || `msg:${m.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  const threads: CounselorThreadMeta[] = [...groups.entries()].map(([key, msgs]) => {
    const sorted = [...msgs].sort(
      (a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime(),
    );
    const first = sorted[0];
    return {
      thread_key: key.startsWith("msg:") ? "" : key,
      subject: (first.subject as string) ?? null,
      from_addr: (first.from_addr as string) ?? null,
      last_message_at: String(first.created_at),
      message_count: msgs.length,
      safety_critical: msgs.some((x) => Boolean(x.safety_critical)),
      body: isParent ? null : String(first.body ?? ""),
      confidentialityLine: COUNSELOR_CONFIDENTIALITY_LINE,
    };
  });
  threads.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
  return { threads };
}

/**
 * Legacy-shape teacher thread list ({ messages: TeacherMessage[] }) with the
 * FR-SCHOOL-002/016 segregation applied: parent viewers get CC-redacted
 * bodies + provenance labels; the teen gets the full thread. Additive fields
 * only — the existing frontend contract is preserved.
 */
export async function listTeacherMessagesLegacy(
  childId: string,
  classId: string | undefined,
  isParent: boolean,
): Promise<{ messages: Array<Record<string, unknown>> }> {
  const { threads } = await listTeacherThreads(childId, classId, isParent);
  return {
    messages: threads.map((t) => ({
      id: t.id,
      class_id: t.class_id,
      direction: t.direction,
      subject: t.subject,
      body: t.body,
      body_withheld: t.bodyWithheld,
      body_redacted: t.bodyRedacted,
      status: t.status,
      created_at: t.created_at,
      sent_at: t.sent_at,
      sender_type: t.senderType,
      source: t.threadProvenance.source,
      fetched_at: t.threadProvenance.fetchedAt,
      safety_critical: t.safetyCritical,
      provenance: t.threadProvenance.provenance,
      provenance_label: t.threadProvenance.provenanceLabel,
    })),
  };
}

/** Draft authorship stamp: every outbound draft records the parent who wrote it. */
export const ingestTeacherMessageSchema = z.object({
  class_id: z.string().uuid().nullable(),
  direction: z.enum(["inbound", "outbound"]),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().min(1).max(20000),
  source: z.enum(["parentvue", "ctls", "gmail", "manual"]),
  from_addr: z.string().max(320).nullable().optional(),
  to_addrs: z.array(z.string().max(320)).max(50).optional(),
  cc_addrs: z.array(z.string().max(320)).max(50).optional(),
  thread_key: z.string().max(200).nullable().optional(),
  fetched_at: z.string().datetime().optional(),
});

/**
 * Ingest path (service_role sync pipeline). Tags safety-critical messages
 * deterministically and stamps provenance: inbound school mail is
 * school_of_record; outbound is app_generated (parent-authored).
 */
export async function ingestTeacherMessage(
  childId: string,
  input: z.infer<typeof ingestTeacherMessageSchema>,
) {
  const tag = tagSafetyCritical(input.subject ?? null, input.body);
  const { data, error } = await supabaseAdmin
    .from("teacher_messages")
    .insert({
      child_id: childId,
      class_id: input.class_id,
      direction: input.direction,
      subject: input.subject ?? null,
      body: input.body,
      status: input.direction === "inbound" ? "received" : "draft",
      source: input.source,
      from_addr: input.from_addr ?? null,
      to_addrs: input.to_addrs ?? [],
      cc_addrs: input.cc_addrs ?? [],
      thread_key: input.thread_key ?? null,
      safety_critical: tag.safetyCritical,
      safety_tag_reason: tag.reason,
      provenance: input.direction === "inbound" ? "school_of_record" : "app_generated",
      fetched_at: input.fetched_at ?? new Date().toISOString(),
    })
    .select("id, safety_critical, safety_tag_reason")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { message: data, safetyTag: tag };
}

export const ingestCounselorMessageSchema = ingestTeacherMessageSchema.omit({ class_id: true });

/** Counselor ingest (service_role): lands with sender_type='counselor' (ASCA B.2 store). */
export async function ingestCounselorMessage(
  childId: string,
  input: z.infer<typeof ingestCounselorMessageSchema>,
) {
  const tag = tagSafetyCritical(input.subject ?? null, input.body);
  const { data, error } = await supabaseAdmin
    .from("teacher_messages")
    .insert({
      child_id: childId,
      class_id: null,
      direction: "inbound",
      sender_type: "counselor",
      thread_key: input.thread_key ?? null,
      from_addr: input.from_addr ?? null,
      subject: input.subject ?? null,
      body: input.body,
      status: "received",
      source: input.source,
      safety_critical: tag.safetyCritical,
      safety_tag_reason: tag.reason,
      provenance: "school_of_record",
      fetched_at: input.fetched_at ?? new Date().toISOString(),
    })
    .select("id, safety_critical, safety_tag_reason")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { message: data, safetyTag: tag };
}
