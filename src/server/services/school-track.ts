// Squad 3 — School Track 🌿: frontend-contract services for the panel-mandated
// redesigns (FR-SCHOOL-001/002/003/004/007/019).
//
// API shapes come from BUILD-SPECIFICATION.md + docs/solutions/sol-school-ai.md.
// Schema: migrations 041–047 (provenance, calibration, sparks, frontend
// contracts) must be applied before these endpoints serve traffic — per the
// staging runbook (code → build → migrations → data → deploy) they are.
// No degradation fallbacks: the schema is real, so the code reads it straight.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, ErrorCodes, failWith, mapDbError } from "@/server/errors";
import { requireParentRole, requireChildRole } from "./school";
import { getMinutiaeCalendar } from "./minutiae";
import type {
  CalibrationSummary,
  StudySpark,
  TeacherMessage,
  TodayCheckin,
} from "@/lib/school/types";

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

/** Fail-closed child-role check — the teen's own writes (checkboxes, check-ins).
 *  Single definition lives in ./school (squad consolidation 2026-10-12). */
export { requireChildRole };

/** Resolve the caller's tenant role for a child ('parent' | 'child' | null). */
export async function tenantRoleFor(childId: string): Promise<"parent" | "child" | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: access } = await supabase
    .from("child_access")
    .select("role")
    .eq("child_id", childId)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = (access as { role: string } | null)?.role;
  return role === "parent" || role === "child" ? role : null;
}

// ---------------------------------------------------------------------------
// Check-in redesign (FR-SCHOOL-003) + lab-safety pulse (FR-SCHOOL-019)
// ---------------------------------------------------------------------------

export const checkinEstimateSchema = z.object({
  label: z.string().min(1).max(120),
  estimate: z.number().min(0).max(100),
});

export const checkinSaveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  mood: z.number().int().min(1).max(5).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  stress: z.number().int().min(1).max(5).optional(),
  text: z.string().max(2000).optional(),
  estimates: z.array(checkinEstimateSchema).max(3).optional(),
  lab_read_safety_card: z.boolean().optional(),
  lab_anonymous_question: z.string().max(1000).optional(),
});

/**
 * Save the teen's check-in (upsert 1/day) with optional outcome estimates and
 * the day-of-lab pulse.
 *
 * Teen-owned write path (FR-SCHOOL-003): requireChildRole — parents never
 * POST here. Estimates land in checkin_estimates (042) with the full
 * provenance the calibration engine needs (child_id, kind, description,
 * estimate_date); the lab pulse lands on the checkin row itself (047).
 */
export async function saveCheckinV2(
  childId: string,
  input: z.infer<typeof checkinSaveSchema>,
): Promise<{ checkin: unknown; estimates_saved: boolean; lab_saved: boolean }> {
  await requireChildRole(childId);
  const supabase = await createClient();

  const fullRow = {
    child_id: childId,
    checkin_date: input.date,
    mood: input.mood ?? null,
    energy: input.energy ?? null,
    stress: input.stress ?? null,
    text: input.text?.trim() ? input.text.trim() : null,
    lab_read_safety_card: input.lab_read_safety_card ?? false,
    lab_anonymous_question: input.lab_anonymous_question?.trim() || null,
  };

  const { data: saved, error: saveErr } = await supabase
    .from("checkins")
    .upsert(fullRow, { onConflict: "child_id,checkin_date" })
    .select("id, child_id, checkin_date, mood, energy, stress, text, created_at")
    .single();
  if (saveErr) throw new ApiError(mapDbError(saveErr, crypto.randomUUID()));
  const row = saved as Record<string, unknown>;

  // Replace the day's estimates (teen-owned, teen-deletable).
  let estimatesSaved = false;
  const checkinId = row.id as string;
  if (input.estimates && input.estimates.length > 0) {
    const del = await supabase.from("checkin_estimates").delete().eq("checkin_id", checkinId);
    if (del.error) throw new ApiError(mapDbError(del.error, crypto.randomUUID()));
    const ins = await supabase.from("checkin_estimates").insert(
      input.estimates.map((e) => ({
        child_id: childId,
        checkin_id: checkinId,
        label: e.label,
        kind: "other" as const,
        description: e.label,
        estimate_date: input.date,
        estimate_pct: e.estimate,
      })),
    );
    if (ins.error) throw new ApiError(mapDbError(ins.error, crypto.randomUUID()));
    estimatesSaved = true;
  } else {
    estimatesSaved = true;
  }

  return { checkin: row, estimates_saved: estimatesSaved, lab_saved: true };
}

/** The teen's own check-in for a date (for delete + the saved state). Never parent-visible. */
export async function getTodayCheckin(childId: string, date: string): Promise<TodayCheckin | null> {
  await requireChildRole(childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkins")
    .select("id, mood, energy, stress, text, lab_read_safety_card, lab_anonymous_question, created_at")
    .eq("child_id", childId)
    .eq("checkin_date", date)
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  if (!data) return null;

  const { data: est, error: estErr } = await supabase
    .from("checkin_estimates")
    .select("id, label, description, estimate_pct, actual_pct")
    .eq("checkin_id", (data as { id: string }).id)
    .order("created_at");
  if (estErr) throw new ApiError(mapDbError(estErr, crypto.randomUUID()));
  const estimates: TodayCheckin["estimates"] = (
    (est ?? []) as Array<{
      id: string;
      label: string | null;
      description: string | null;
      estimate_pct: number;
      actual_pct: number | null;
    }>
  ).map((e) => ({
    id: e.id,
    label: e.label ?? e.description ?? "estimate",
    estimate_pct: Number(e.estimate_pct),
    actual_pct: e.actual_pct == null ? null : Number(e.actual_pct),
  }));

  const d = data as {
    id: string;
    mood: number | null;
    energy: number | null;
    stress: number | null;
    text: string | null;
    lab_read_safety_card?: boolean | null;
    lab_anonymous_question?: string | null;
  };
  return {
    id: d.id,
    mood: d.mood,
    energy: d.energy,
    stress: d.stress,
    text: d.text,
    lab_read_safety_card: d.lab_read_safety_card ?? false,
    lab_anonymous_question: d.lab_anonymous_question ?? null,
    estimates,
  };
}

/**
 * Rolling calibration for the teen (FR-SCHOOL-003 §5.1):
 * last 10 paired estimates → mean |estimate − actual| → band.
 * Teen-only: requireChildRole; parents can never reach this.
 *
 * SEAM: actual_pct is paired by the sync worker when the graded outcome
 * arrives (tech lead). Unpaired estimates don't count toward the score.
 */
export async function getCalibration(childId: string): Promise<CalibrationSummary> {
  await requireChildRole(childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkin_estimates")
    .select("estimate_pct, actual_pct, created_at")
    .eq("child_id", childId)
    .not("actual_pct", "is", null)
    .order("paired_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  const rows = ((data ?? []) as Array<{
    estimate_pct: number;
    actual_pct: number;
    created_at: string;
  }>).map((r) => ({
    estimate_pct: Number(r.estimate_pct),
    actual_pct: Number(r.actual_pct),
    created_at: r.created_at,
  }));

  const paired = rows.length;
  if (paired < 5) {
    // Small-n guard: no score until ≥5 paired estimates.
    return { paired, mean_error_pts: null, band: "warming", trend_pts: null };
  }
  const errors = rows.map((r) => Math.abs(r.estimate_pct - r.actual_pct));
  const mean = errors.reduce((a, b) => a + b, 0) / errors.length;
  // Trend: first-half mean error vs second-half (chronological).
  const chrono = [...errors].reverse();
  const half = Math.floor(chrono.length / 2);
  const first = chrono.slice(0, half).reduce((a, b) => a + b, 0) / Math.max(half, 1);
  const second = chrono.slice(half).reduce((a, b) => a + b, 0) / Math.max(chrono.length - half, 1);
  const trend = +(first - second).toFixed(1);
  const band = trend > 2 ? "sharpening" : trend < -2 ? "warming" : "steady";
  return { paired, mean_error_pts: +mean.toFixed(1), band, trend_pts: trend };
}

/** Teen-deletable check-ins (FR-SCHOOL-003): immediate, across app + API. */
export async function deleteCheckin(childId: string, checkinId: string): Promise<{ deleted: boolean }> {
  await requireChildRole(childId);
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("checkins")
    .delete({ count: "exact" })
    .eq("id", checkinId)
    .eq("child_id", childId);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { deleted: (count ?? 0) > 0 };
}

/**
 * Lab-day detection for the morning check-in (FR-SCHOOL-019): today's
 * minutiae calendar events mentioning a lab. Real data flow — if nothing
 * matches, no pulse renders (no fake lab days).
 */
export async function getLabToday(childId: string): Promise<{ class_name: string } | null> {
  const supabase = await createClient();
  const tzRes = await supabase
    .from("children")
    .select("timezone")
    .eq("id", childId)
    .maybeSingle();
  const tz = ((tzRes.data as { timezone?: string } | null)?.timezone) ?? "America/New_York";
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(new Date());

  const events = await getMinutiaeCalendar(childId);
  const lab = events.find(
    (e) => e.event_date === today && /lab/i.test(`${e.title} ${e.detail ?? ""}`),
  );
  if (!lab) return null;
  // Best-effort class name from the event title ("Chem lab" → "Chem").
  const className = lab.title.replace(/\s*lab\b.*/i, "").trim() || lab.title;
  return { class_name: className };
}

// ---------------------------------------------------------------------------
// Path-to-90 checkbox ownership (FR-SCHOOL-007): the teen owns the checkboxes;
// parents are read-only on them. Parent keeps draft + review (safety_status).
// ---------------------------------------------------------------------------

export const planItemsPatchSchema = z.object({
  items: z.array(z.object({ rank: z.number().int().min(1), done: z.boolean() })).min(1).max(10),
});

/** Teen toggles their own action steps. 403 for any other role. */
export async function togglePlanItems(
  childId: string,
  planId: string,
  items: z.infer<typeof planItemsPatchSchema>["items"],
): Promise<{ updated: boolean }> {
  await requireChildRole(childId);
  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("study_plans")
    .select("id, plan")
    .eq("child_id", childId)
    .eq("id", planId)
    .maybeSingle();
  if (fetchErr) throw new ApiError(mapDbError(fetchErr, crypto.randomUUID()));
  if (!existing) failWith(ErrorCodes.NOT_FOUND);

  const doneByRank = new Map(items.map((i) => [i.rank, i.done]));
  const merged = ((existing as { plan: Array<{ rank: number; done?: boolean }> }).plan ?? []).map((a) =>
    doneByRank.has(a.rank) ? { ...a, done: doneByRank.get(a.rank) } : a,
  );
  const { error } = await supabase
    .from("study_plans")
    .update({ plan: merged })
    .eq("child_id", childId)
    .eq("id", planId);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { updated: true };
}

/** Parent reviews the plan's safety gate — checkboxes stay teen-owned. */
export async function reviewPlan(
  childId: string,
  planId: string,
  safetyStatus: "approved" | "rejected",
): Promise<{ updated: boolean }> {
  await requireParentRole(childId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("study_plans")
    .update({ safety_status: safetyStatus })
    .eq("child_id", childId)
    .eq("id", planId);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { updated: true };
}

// ---------------------------------------------------------------------------
// Teacher inbox with provenance (FR-SCHOOL-001/002): counselor segregation,
// per-message provenance, parent metadata-only on counselor threads.
// ---------------------------------------------------------------------------

const MESSAGE_COLUMNS =
  "id, class_id, direction, subject, body, status, created_at, sent_at, sender_type, source, safety_critical, fetched_at";

async function selectMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  childId: string,
  classId?: string,
  limit = 30,
) {
  let q = supabase
    .from("teacher_messages")
    .select(MESSAGE_COLUMNS)
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (classId) q = q.eq("class_id", classId);
  const res = await q;
  if (res.error) throw new ApiError(mapDbError(res.error, crypto.randomUUID()));
  return { rows: res.data ?? [], provenanceReady: true };
}

/**
 * List messages with provenance + counselor segregation.
 *
 * Visibility (sol-school-ai §4.2): the teen sees everything. A parent sees
 * teacher threads in full (redaction of other students is a separate service)
 * but counselor threads as METADATA ONLY — body stripped, flagged
 * body_withheld — until the teen grants the counselor_communications scope
 * (scope unlock is a platform-backend seam; conservative default = strip).
 */
export async function listMessagesV2(
  childId: string,
  classId: string | undefined,
  role: "parent" | "child" | null,
): Promise<{ messages: TeacherMessage[]; provenance_ready: boolean }> {
  const supabase = await createClient();
  const { rows, provenanceReady } = await selectMessages(supabase, childId, classId);

  const messages = (rows as Array<Record<string, unknown>>).map((m) => {
    const senderType =
      (m.sender_type as string | undefined) ?? (m.class_id == null ? "counselor" : "teacher");
    const isCounselor = senderType === "counselor";
    const withheld = role === "parent" && isCounselor;
    return {
      id: m.id,
      class_id: m.class_id,
      direction: m.direction,
      subject: m.subject,
      body: withheld ? "" : m.body,
      body_withheld: withheld,
      status: m.status,
      created_at: m.created_at,
      sent_at: m.sent_at,
      sender_type: senderType,
      source: (m.source as string | undefined) ?? "manual",
      safety_critical: (m.safety_critical as boolean | undefined) ?? false,
      fetched_at: (m.fetched_at as string | null | undefined) ?? null,
    } as TeacherMessage;
  });
  return { messages, provenance_ready: provenanceReady };
}

// ---------------------------------------------------------------------------
// Study Sparks (FR-SCHOOL-004)
// ---------------------------------------------------------------------------

/**
 * Live (non-expired) Study Sparks for the child/class. Reads only — the
 * pipeline writes rows (SEAM). If 024 isn't applied yet, returns [] so the
 * section simply doesn't render (never a fake spark).
 */
export async function listStudySparks(
  childId: string,
  classId?: string,
): Promise<{ sparks: StudySpark[] }> {
  const supabase = await createClient();
  // 043: child_id NULL = global technique-library spark (visible to all teens).
  let q = supabase
    .from("study_sparks")
    .select(
      "id, class_id, body, origin, source_refs, deident_method, study_skill_tags, review_status, ai_label, expires_at, created_at",
    )
    .or(`child_id.eq.${childId},child_id.is.null`)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(12);
  if (classId) q = q.eq("class_id", classId);
  const { data, error } = await q;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return {
    sparks: ((data ?? []) as Array<Record<string, unknown>>).map((s) => ({
      id: s.id,
      class_id: s.class_id,
      body: s.body,
      origin: s.origin,
      source_refs: s.source_refs,
      deident_method: s.deident_method,
      study_skill_tags: s.study_skill_tags,
      review_status: s.review_status,
      ai_label: s.ai_label,
      expires_at: s.expires_at,
      created_at: s.created_at,
    })) as StudySpark[],
  };
}
