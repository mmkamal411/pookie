// W1 School Core — framework-free business logic (per MODULE-ARCHITECTURE.md §1).
// Handlers are thin: validate → resolve tenant → call service → audit.
// Every query uses the user-JWT server client; RLS (current_child_ids()) enforces tenancy.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, ErrorCodes, failWith, mapDbError } from "@/server/errors";
import type {
  AssignmentItem,
  ClassDetail,
  ClassFile,
  ClassOverview,
  DueNextItem,
  SchoolOverview,
  StudyPlan,
  TeacherMessage,
} from "@/lib/school/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Shared validation
// ---------------------------------------------------------------------------

export const planActionSchema = z.object({
  rank: z.number().int().min(1),
  action: z.string().min(1).max(500),
  why: z.string().max(500).optional(),
  done: z.boolean().default(false),
});

export const checkinSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  mood: z.number().int().min(1).max(5).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  stress: z.number().int().min(1).max(5).optional(),
  text: z.string().max(2000).optional(),
});

export const planCreateSchema = z.object({
  class_id: z.string().uuid(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "week_start must be YYYY-MM-DD"),
  plan: z.array(planActionSchema).min(1).max(10),
});

export const planPatchSchema = z.object({
  items: z
    .array(z.object({ rank: z.number().int().min(1), done: z.boolean() }))
    .min(1)
    .max(10)
    .optional(),
  safety_status: z.enum(["approved", "rejected"]).optional(),
});

export const assignmentCreateSchema = z.object({
  class_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  category: z.string().max(60).optional(),
  due_date: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

export const teacherMessageDraftSchema = z.object({
  class_id: z.string().uuid().nullable(),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
});

// ---------------------------------------------------------------------------
// Tenant helpers
// ---------------------------------------------------------------------------

/**
 * Fail-closed parent check. Does NOT rely on assertTenant()'s role default
 * (which falls back to 'parent' when no child_access row exists — flagged as
 * a merge blocker in the baseline audit, M2). Every parent-gated W1 route
 * calls this instead of assertParent().
 */
export async function requireParentRole(childId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  const { data: access } = await supabase
    .from("child_access")
    .select("role")
    .eq("child_id", childId)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = (access as { role: string } | null)?.role;
  if (role !== "parent") failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  return user.id;
}

/**
 * Fail-closed teen check. Requires a REAL child_access row with role='child'
 * — never the assertTenant() fall-through default. Used by every teen-only
 * surface (calibration, estimates, teen-deletable check-ins, Path-to-90
 * checkbox writes, AI-practice opt-in toggle).
 */
export async function requireChildRole(childId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  const { data: access } = await supabase
    .from("child_access")
    .select("role")
    .eq("child_id", childId)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = (access as { role: string } | null)?.role;
  if (role !== "child") failWith(ErrorCodes.CHILD_ROLE_REQUIRED);
  return user.id;
}

/** Assert a class belongs to the child; 404 NOT_FOUND if not (safe: existence already tenant-scoped). */
async function assertClassInTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  childId: string,
  classId: string,
) {
  const { data: cls, error } = await supabase
    .from("classes")
    .select("id, class_slug, name, display_name, period, teacher_name, teacher_email")
    .eq("child_id", childId)
    .eq("id", classId)
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  if (!cls) failWith(ErrorCodes.NOT_FOUND);
  return cls as {
    id: string;
    class_slug: string;
    name: string;
    display_name: string | null;
    period: string | null;
    teacher_name: string | null;
    teacher_email: string | null;
  };
}

/** Child's timezone (for send-window math and today's check-in). */
async function getChildTimezone(childId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("children")
    .select("timezone")
    .eq("id", childId)
    .maybeSingle();
  return ((data as { timezone: string | null } | null)?.timezone ?? "America/New_York");
}

/** Today's date (YYYY-MM-DD) in the child's timezone. */
function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Current local hour (0–23) in the child's timezone. */
function localHourInTz(tz: string): number {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(new Date()),
  );
  return h % 24;
}

/** The child's send window — child_settings.send_window or the 06:00–22:00 default. */
async function getSendWindow(childId: string): Promise<{ start: string; end: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("child_settings")
    .select("send_window")
    .eq("child_id", childId)
    .maybeSingle();
  const raw = (data as { send_window: { start?: string; end?: string } | null } | null)?.send_window;
  return {
    start: raw?.start ?? "06:00",
    end: raw?.end ?? "22:00",
  };
}

function hourOf(hhmm: string): number {
  return Number(hhmm.split(":")[0]);
}

/** True when a teacher-facing send/approve may go out right now (06:00–22:00 local). */
async function withinSendWindow(childId: string, tz: string): Promise<boolean> {
  const { start, end } = await getSendWindow(childId);
  const h = localHourInTz(tz);
  return h >= hourOf(start) && h < hourOf(end);
}

/** True when the child has a check-in row for today (child-local). */
export async function hasCheckinToday(childId: string): Promise<boolean> {
  const supabase = await createClient();
  const tz = await getChildTimezone(childId);
  const { data } = await supabase
    .from("checkins")
    .select("id")
    .eq("child_id", childId)
    .eq("checkin_date", todayInTz(tz))
    .maybeSingle();
  return !!data;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function getSchoolOverview(childId: string): Promise<SchoolOverview> {
  // F3: Never throw — return empty overview on failure so the dashboard
  // shell renders instead of crashing to the error boundary.
  // Each failure is logged with a structured error ID for RCA.
  try {
    return await getSchoolOverviewInner(childId);
  } catch (err) {
    const id = crypto.randomUUID().slice(0, 8);
    console.error(`[${id}] school/getSchoolOverview :: child ${childId} :: ${err instanceof Error ? err.message : String(err)}`);
    return { classes: [], due_next: [], checkin_today: false };
  }
}

async function getSchoolOverviewInner(childId: string): Promise<SchoolOverview> {
  const supabase = await createClient();

  const { data: classes, error: classErr } = await supabase
    .from("classes")
    .select("id, class_slug, name, display_name, period, teacher_name")
    .eq("child_id", childId)
    .eq("active", true)
    .order("display_order");
  if (classErr) throw new ApiError(mapDbError(classErr, crypto.randomUUID()));
  const classRows = (classes ?? []) as Array<{
    id: string;
    class_slug: string;
    name: string;
    display_name: string | null;
    period: string | null;
    teacher_name: string | null;
  }>;

  // Latest grade row per class (most recent sync wins).
  const { data: gradeRows, error: gradeErr } = await supabase
    .from("grades")
    .select("class_id, term, numeric, synced_at")
    .eq("child_id", childId)
    .order("synced_at", { ascending: false });
  if (gradeErr) throw new ApiError(mapDbError(gradeErr, crypto.randomUUID()));
  const latestGrade = new Map<string, { term: string; numeric: number | null }>();
  for (const g of (gradeRows ?? []) as Array<{ class_id: string; term: string; numeric: number | null }>) {
    if (!latestGrade.has(g.class_id)) latestGrade.set(g.class_id, { term: g.term, numeric: g.numeric });
  }

  // 7-day delta: snapshot closest to exactly 7 days ago, same term.
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const { data: snapRows } = await supabase
    .from("grade_snapshots")
    .select("class_id, term, numeric, taken_at")
    .eq("child_id", childId)
    .gte("taken_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());
  const baseline = new Map<string, number | null>();
  const baselineDist = new Map<string, number>();
  for (const s of (snapRows ?? []) as Array<{ class_id: string; term: string; numeric: number | null; taken_at: string }>) {
    const key = `${s.class_id}::${s.term}`;
    const dist = Math.abs(new Date(s.taken_at).getTime() - sevenDaysAgo);
    if (dist < (baselineDist.get(key) ?? Infinity)) {
      baselineDist.set(key, dist);
      baseline.set(key, s.numeric);
    }
  }

  const overview: ClassOverview[] = classRows.map((c) => {
    const g = latestGrade.get(c.id) ?? { term: null, numeric: null };
    const b = g.term != null ? baseline.get(`${c.id}::${g.term}`) : undefined;
    return {
      class_id: c.id,
      class_slug: c.class_slug,
      name: c.name,
      display_name: c.display_name,
      period: c.period,
      teacher_name: c.teacher_name,
      term: g.term ?? null,
      numeric: g.numeric,
      delta_7d: b != null && g.numeric != null && b != null ? +(g.numeric - b).toFixed(1) : null,
    };
  });

  // Due-next rail: the due_next view (security_invoker — caller RLS applies).
  const { data: dueRows, error: dueErr } = await supabase
    .from("due_next")
    .select("id, class_id, title, category, due_date, status, points_earned, points_possible, notes")
    .eq("child_id", childId)
    .order("due_date", { ascending: true })
    .limit(10);
  if (dueErr) throw new ApiError(mapDbError(dueErr, crypto.randomUUID()));
  const slugById = new Map(classRows.map((c) => [c.id, { slug: c.class_slug, name: c.display_name ?? c.name }]));
  const due_next: DueNextItem[] = ((dueRows ?? []) as Array<{
    id: string;
    class_id: string;
    title: string;
    category: string | null;
    due_date: string | null;
    status: string;
    points_earned: number | null;
    points_possible: number | null;
    notes: string | null;
  }>).map((a) => ({
    id: a.id,
    class_id: a.class_id,
    class_slug: slugById.get(a.class_id)?.slug ?? "",
    class_name: slugById.get(a.class_id)?.name ?? "",
    title: a.title,
    category: a.category,
    due_date: a.due_date,
    status: a.status,
    points_earned: a.points_earned,
    points_possible: a.points_possible,
    notes: a.notes,
  }));

  const checkin_today = await hasCheckinToday(childId);

  return { classes: overview, due_next, checkin_today };
}

// ---------------------------------------------------------------------------
// Class detail
// ---------------------------------------------------------------------------

export async function getClassDetail(childId: string, classId: string): Promise<ClassDetail> {
  const supabase = await createClient();
  const cls = await assertClassInTenant(supabase, childId, classId);

  const [{ data: grade }, { data: history }, { data: assignments }, { data: plan }, thread] =
    await Promise.all([
      supabase
        .from("grades")
        .select("term, numeric")
        .eq("child_id", childId)
        .eq("class_id", classId)
        .order("synced_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("grade_snapshots")
        .select("taken_at, numeric")
        .eq("child_id", childId)
        .eq("class_id", classId)
        .order("taken_at", { ascending: false })
        .limit(26),
      supabase
        .from("assignments")
        .select("id, class_id, title, category, due_date, status, points_earned, points_possible, notes")
        .eq("child_id", childId)
        .eq("class_id", classId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(50),
      supabase
        .from("study_plans")
        .select("id, class_id, week_start, plan, generated_by, safety_status, status, created_at")
        .eq("child_id", childId)
        .eq("class_id", classId)
        .eq("status", "active")
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      selectTeacherThread(supabase, childId, classId),
    ]);

  return {
    class: cls,
    grade: (grade as { term: string; numeric: number | null } | null) ?? null,
    history: ((history ?? []) as Array<{ taken_at: string; numeric: number | null }>),
    assignments: ((assignments ?? []) as AssignmentItem[]),
    study_plan: (plan as StudyPlan | null) ?? null,
    teacher_thread: thread,
  };
}

/**
 * Class-page teacher thread with provenance (FR-SCHOOL-001/002): the class
 * thread plus the segregated counselor store (class_id NULL per the 006
 * route rule, or sender_type='counselor'). Tries the 024 provenance columns,
 * falls back to legacy columns until 024 is applied (SEAM).
 */
async function selectTeacherThread(
  supabase: Awaited<ReturnType<typeof createClient>>,
  childId: string,
  classId: string,
): Promise<TeacherMessage[]> {
  const FULL =
    "id, class_id, direction, subject, body, status, created_at, sent_at, sender_type, source, safety_critical, fetched_at";
  const LEGACY = "id, class_id, direction, subject, body, status, created_at, sent_at";
  const orFilter = `class_id.eq.${classId},class_id.is.null`;

  let rows: Array<Record<string, unknown>> = [];
  try {
    const { data, error } = await supabase
      .from("teacher_messages")
      .select(FULL)
      .eq("child_id", childId)
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw error;
    rows = (data ?? []) as Array<Record<string, unknown>>;
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string } | null;
    const missingColumn = e?.code === "42703" || /column .* does not exist/i.test(e?.message ?? "");
    if (!missingColumn) throw new ApiError(mapDbError(err, crypto.randomUUID()));
    const { data, error } = await supabase
      .from("teacher_messages")
      .select(LEGACY)
      .eq("child_id", childId)
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
    rows = (data ?? []) as Array<Record<string, unknown>>;
  }

  return rows.map((m) => ({
    id: m.id,
    class_id: m.class_id,
    direction: m.direction,
    subject: m.subject,
    body: m.body,
    status: m.status,
    created_at: m.created_at,
    sent_at: m.sent_at,
    sender_type:
      (m.sender_type as "teacher" | "counselor" | undefined) ??
      (m.class_id == null ? "counselor" : "teacher"),
    source: (m.source as string | undefined) ?? "manual",
    safety_critical: (m.safety_critical as boolean | undefined) ?? false,
    fetched_at: (m.fetched_at as string | null | undefined) ?? null,
  })) as TeacherMessage[];
}

// ---------------------------------------------------------------------------
// Due next (explicit route — supports days + class filters over the view)
// ---------------------------------------------------------------------------

export async function getDueNext(
  childId: string,
  days: number,
  classId?: string,
): Promise<{ items: DueNextItem[] }> {
  const supabase = await createClient();
  let query = supabase
    .from("due_next")
    .select("id, class_id, title, category, due_date, status, points_earned, points_possible, notes")
    .eq("child_id", childId)
    .lte("due_date", new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString())
    .order("due_date", { ascending: true })
    .limit(50);
  if (classId) {
    await assertClassInTenant(supabase, childId, classId);
    query = query.eq("class_id", classId);
  }
  const { data, error } = await query;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));

  const { data: classes } = await supabase
    .from("classes")
    .select("id, class_slug, name, display_name")
    .eq("child_id", childId);
  const meta = new Map(
    ((classes ?? []) as Array<{ id: string; class_slug: string; name: string; display_name: string | null }>).map(
      (c) => [c.id, { slug: c.class_slug, name: c.display_name ?? c.name }],
    ),
  );

  const items: DueNextItem[] = ((data ?? []) as Array<{
    id: string;
    class_id: string;
    title: string;
    category: string | null;
    due_date: string | null;
    status: string;
    points_earned: number | null;
    points_possible: number | null;
    notes: string | null;
  }>).map((a) => ({
    id: a.id,
    class_id: a.class_id,
    class_slug: meta.get(a.class_id)?.slug ?? "",
    class_name: meta.get(a.class_id)?.name ?? "",
    title: a.title,
    category: a.category,
    due_date: a.due_date,
    status: a.status,
    points_earned: a.points_earned,
    points_possible: a.points_possible,
    notes: a.notes,
  }));
  return { items };
}

// ---------------------------------------------------------------------------
// Assignments (parent manual rows)
// ---------------------------------------------------------------------------

export async function listAssignments(childId: string, classId?: string): Promise<{ items: AssignmentItem[] }> {
  const supabase = await createClient();
  let query = supabase
    .from("assignments")
    .select("id, class_id, title, category, due_date, status, points_earned, points_possible, notes")
    .eq("child_id", childId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(100);
  if (classId) {
    await assertClassInTenant(supabase, childId, classId);
    query = query.eq("class_id", classId);
  }
  const { data, error } = await query;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { items: ((data ?? []) as AssignmentItem[]) };
}

export async function createAssignment(
  childId: string,
  input: z.infer<typeof assignmentCreateSchema>,
): Promise<{ assignment: AssignmentItem }> {
  const supabase = await createClient();
  await assertClassInTenant(supabase, childId, input.class_id);
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      child_id: childId,
      class_id: input.class_id,
      source_id: null,
      title: input.title,
      category: input.category ?? null,
      due_date: input.due_date ?? null,
      status: "upcoming",
      notes: input.notes ?? null,
      // FR-SCHOOL-001: manual rows are app-generated (family-created), tagged
      // at write time. Sync rows keep the school_of_record default.
      provenance: "app_generated",
    })
    .select("id, class_id, title, category, due_date, status, points_earned, points_possible, notes")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { assignment: data as AssignmentItem };
}

// ---------------------------------------------------------------------------
// Check-ins (upsert 1 row/child/day). No list route for parents — aggregates only (W8).
// ---------------------------------------------------------------------------

export async function saveCheckin(childId: string, input: z.infer<typeof checkinSchema>) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkins")
    .upsert(
      {
        child_id: childId,
        checkin_date: input.date,
        mood: input.mood ?? null,
        energy: input.energy ?? null,
        stress: input.stress ?? null,
        text: input.text ?? null,
      },
      { onConflict: "child_id,checkin_date" },
    )
    .select("id, child_id, checkin_date, mood, energy, stress, text, created_at")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { checkin: data };
}

// ---------------------------------------------------------------------------
// Study plans (Path-to-90)
// ---------------------------------------------------------------------------

export async function listPlans(
  childId: string,
  classId?: string,
  week?: string,
): Promise<{ plans: StudyPlan[] }> {
  const supabase = await createClient();
  let query = supabase
    .from("study_plans")
    .select("id, class_id, week_start, plan, generated_by, safety_status, status, created_at")
    .eq("child_id", childId)
    .order("week_start", { ascending: false })
    .limit(20);
  if (classId) {
    await assertClassInTenant(supabase, childId, classId);
    query = query.eq("class_id", classId);
  }
  if (week) query = query.eq("week_start", week);
  const { data, error } = await query;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { plans: ((data ?? []) as StudyPlan[]) };
}

export async function createPlan(
  childId: string,
  input: z.infer<typeof planCreateSchema>,
): Promise<{ plan: StudyPlan }> {
  const supabase = await createClient();
  await assertClassInTenant(supabase, childId, input.class_id);
  const { data, error } = await supabase
    .from("study_plans")
    .insert({
      child_id: childId,
      class_id: input.class_id,
      week_start: input.week_start,
      plan: input.plan,
      generated_by: "parent",
      safety_status: "pending",
      status: "active",
    })
    .select("id, class_id, week_start, plan, generated_by, safety_status, status, created_at")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { plan: data as StudyPlan };
}

/** Parent-only: flip done flags on ranked actions and/or review safety_status. */
export async function patchPlan(
  childId: string,
  planId: string,
  input: z.infer<typeof planPatchSchema>,
): Promise<{ plan: StudyPlan }> {
  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("study_plans")
    .select("id, child_id, plan")
    .eq("child_id", childId)
    .eq("id", planId)
    .maybeSingle();
  if (fetchErr) throw new ApiError(mapDbError(fetchErr, crypto.randomUUID()));
  if (!existing) failWith(ErrorCodes.NOT_FOUND);

  const updates: Record<string, unknown> = {};
  if (input.items) {
    const doneByRank = new Map(input.items.map((i) => [i.rank, i.done]));
    const merged = ((existing as { plan: Array<{ rank: number; done?: boolean }> }).plan ?? []).map((a) =>
      doneByRank.has(a.rank) ? { ...a, done: doneByRank.get(a.rank) } : a,
    );
    updates.plan = merged;
  }
  if (input.safety_status) updates.safety_status = input.safety_status;

  const { data, error } = await supabase
    .from("study_plans")
    .update(updates)
    .eq("child_id", childId)
    .eq("id", planId)
    .select("id, class_id, week_start, plan, generated_by, safety_status, status, created_at")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { plan: data as StudyPlan };
}

// ---------------------------------------------------------------------------
// Teacher messages — draft → approved → sent, parent-only, send-window gated
// ---------------------------------------------------------------------------

export async function listTeacherMessages(
  childId: string,
  classId?: string,
): Promise<{ messages: TeacherMessage[] }> {
  const supabase = await createClient();
  let query = supabase
    .from("teacher_messages")
    .select("id, class_id, direction, subject, body, status, created_at, sent_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (classId) {
    await assertClassInTenant(supabase, childId, classId);
    query = query.eq("class_id", classId);
  }
  const { data, error } = await query;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { messages: ((data ?? []) as TeacherMessage[]) };
}

export async function draftTeacherMessage(
  childId: string,
  input: z.infer<typeof teacherMessageDraftSchema>,
  authoredBy?: string,
): Promise<{ message: TeacherMessage }> {
  const supabase = await createClient();
  if (input.class_id) await assertClassInTenant(supabase, childId, input.class_id);
  const { data, error } = await supabase
    .from("teacher_messages")
    .insert({
      child_id: childId,
      class_id: input.class_id,
      direction: "outbound",
      subject: input.subject ?? null,
      body: input.body,
      status: "draft",
      // FR-AI-004 parent-authorship: the draft is parent-composed (blank draft —
      // no AI-generated draft, no template-filled send). authored_by records
      // WHO wrote it; approval sends the exact approved bytes.
      authored_by: authoredBy ?? null,
      provenance: "app_generated",
      source: "manual",
    })
    .select("id, class_id, direction, subject, body, status, created_at, sent_at")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { message: data as TeacherMessage };
}

interface ApproveResult {
  message: TeacherMessage;
  held: boolean;
  send_after_date: string | null;
}

export async function approveTeacherMessage(childId: string, msgId: string): Promise<ApproveResult> {
  const userId = await requireParentRole(childId);
  const supabase = await createClient();
  const { data: msg, error: fetchErr } = await supabase
    .from("teacher_messages")
    .select("id, child_id, class_id, direction, subject, body, status, created_at, sent_at")
    .eq("child_id", childId)
    .eq("id", msgId)
    .maybeSingle();
  if (fetchErr) throw new ApiError(mapDbError(fetchErr, crypto.randomUUID()));
  if (!msg) failWith(ErrorCodes.NOT_FOUND);
  const row = msg as TeacherMessage & { child_id: string };
  if (row.direction !== "outbound" || row.status !== "draft") failWith(ErrorCodes.CONFLICT);

  // Approves the exact body as stored — nothing else can be injected here.
  const tz = await getChildTimezone(childId);
  const inWindow = await withinSendWindow(childId, tz);
  const { data, error } = await supabase
    .from("teacher_messages")
    .update({ status: "approved", approved_by: userId, approved_at: new Date().toISOString() })
    .eq("child_id", childId)
    .eq("id", msgId)
    .eq("status", "draft") // optimistic guard — the row cannot move twice
    .select("id, class_id, direction, subject, body, status, created_at, sent_at")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  if (!data) failWith(ErrorCodes.CONFLICT);

  // Outside 06:00–22:00 local the approval is HELD — standing send-window rule.
  // Auto-send at 06:00 is a future worker; the response carries when it may go.
  if (!inWindow) {
    const hour = localHourInTz(tz);
    const date = todayInTz(tz);
    const send_after_date = hour >= 22
      ? new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
          new Date(Date.now() + 24 * 60 * 60 * 1000),
        )
      : date;
    return { message: data as TeacherMessage, held: true, send_after_date };
  }
  return { message: data as TeacherMessage, held: false, send_after_date: null };
}

export async function sendTeacherMessage(childId: string, msgId: string): Promise<{ message: TeacherMessage }> {
  await requireParentRole(childId);
  const supabase = await createClient();
  const tz = await getChildTimezone(childId);
  if (!(await withinSendWindow(childId, tz))) failWith(ErrorCodes.CONFLICT);

  const { data: msg, error: fetchErr } = await supabase
    .from("teacher_messages")
    .select("id, direction, status")
    .eq("child_id", childId)
    .eq("id", msgId)
    .maybeSingle();
  if (fetchErr) throw new ApiError(mapDbError(fetchErr, crypto.randomUUID()));
  if (!msg) failWith(ErrorCodes.NOT_FOUND);
  const row = msg as { direction: string; status: string };
  if (row.direction !== "outbound" || row.status !== "approved") failWith(ErrorCodes.CONFLICT);

  // v1 marks the message sent (actual transmission integrations are future work).
  const { data, error } = await supabase
    .from("teacher_messages")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("child_id", childId)
    .eq("id", msgId)
    .eq("status", "approved") // optimistic guard
    .select("id, class_id, direction, subject, body, status, created_at, sent_at")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  if (!data) failWith(ErrorCodes.CONFLICT);
  return { message: data as TeacherMessage };
}

// ---------------------------------------------------------------------------
// Class files — handout uploads reuse the class-files bucket convention:
//   <uid>/<child-slug>/<class-slug>/<yyyy-mm-dd>/<file>. Signed URLs only.
// service_role is allowed here (API route, server-only) — never client code.
// ---------------------------------------------------------------------------

const CLASS_FILES_BUCKET = "class-files";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function uploadClassFile(
  childId: string,
  classId: string,
  userId: string,
  file: File,
): Promise<{ path: string }> {
  const cls = await assertClassInTenant(await createClient(), childId, classId);
  if (file.size > MAX_UPLOAD_BYTES) failWith(ErrorCodes.VALIDATION_FAILED);

  const supabase = await createClient();
  const { data: child } = await supabase.from("children").select("slug").eq("id", childId).maybeSingle();
  const childSlug = ((child as { slug: string } | null)?.slug ?? childId);
  const date = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const path = `${userId}/${childSlug}/${cls.class_slug}/${date}/${crypto.randomUUID()}-${safeName}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage
    .from(CLASS_FILES_BUCKET)
    .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { path };
}

export async function listClassFiles(childId: string, classId: string): Promise<{ files: ClassFile[] }> {
  const cls = await assertClassInTenant(await createClient(), childId, classId);
  const supabase = await createClient();
  const { data: child } = await supabase.from("children").select("slug").eq("id", childId).maybeSingle();
  const childSlug = ((child as { slug: string } | null)?.slug ?? childId);
  const { data: session } = await supabase.auth.getUser();
  const uid = session.user?.id;

  // Uploads nest under <uid>/<child-slug>/<class-slug>/<yyyy-mm-dd>/<file>.
  const classPrefix = `${uid}/${childSlug}/${cls.class_slug}`;
  const { data: dayFolders, error: dayErr } = await supabaseAdmin.storage
    .from(CLASS_FILES_BUCKET)
    .list(classPrefix, { limit: 60, sortBy: { column: "name", order: "desc" } });
  if (dayErr) throw new ApiError(mapDbError(dayErr, crypto.randomUUID()));

  const files: ClassFile[] = [];
  for (const day of dayFolders ?? []) {
    if (!day.name) continue;
    const { data: entries } = await supabaseAdmin.storage
      .from(CLASS_FILES_BUCKET)
      .list(`${classPrefix}/${day.name}`, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
    for (const entry of entries ?? []) {
      if (!entry.name) continue;
      const fullPath = `${classPrefix}/${day.name}/${entry.name}`;
      const { data: signed } = await supabaseAdmin.storage
        .from(CLASS_FILES_BUCKET)
        .createSignedUrl(fullPath, 60 * 15);
      files.push({
        name: entry.name.replace(/^[0-9a-f-]{36}-/, ""),
        path: fullPath,
        signed_url: signed?.signedUrl ?? "",
        created_at: (entry as { created_at?: string }).created_at ?? null,
      });
      if (files.length >= 50) break;
    }
    if (files.length >= 50) break;
  }
  return { files };
}
