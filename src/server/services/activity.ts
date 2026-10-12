// Activity Tracking — framework-free business logic (Phase1 W22).
// Household-anchored (owner_user_id); RLS via is_household_member().
// child_id = null means the workout belongs to the user themself.
// Calories are an optional logged figure — never a target or goal.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, ErrorCodes, mapDbError } from "@/server/errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type WorkoutType =
  | "run" | "walk" | "bike" | "swim" | "gym" | "sport" | "other";

export interface Workout {
  id: string;
  owner_user_id: string;
  child_id: string | null;
  type: WorkoutType;
  duration_min: number;
  distance_mi: string | number | null;
  calories: number | null;
  notes: string | null;
  logged_at: string;
  created_at: string;
}

export interface WeekTotal {
  week_start: string; // YYYY-MM-DD (Monday)
  workouts: number;
  minutes: number;
  miles: number;
}

export interface ActivitySummary {
  workouts_this_week: number;
  minutes_this_week: number;
  miles_this_week: number;
  streak_days: number;
  week_totals: WeekTotal[];
}

export interface DaySteps {
  logged_date: string;
  steps: number;
  step_goal: number;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const childIdSchema = z.string().uuid().optional().nullable();

export const workoutCreateSchema = z.object({
  type: z.enum(["run", "walk", "bike", "swim", "gym", "sport", "other"]),
  duration_min: z.coerce.number().int().min(1).max(1440),
  distance_mi: z.coerce.number().min(0).max(1000).optional(),
  calories: z.coerce.number().int().min(0).max(20000).optional(),
  notes: z.string().max(500).optional(),
  logged_at: z.string().datetime({ offset: true }).optional(),
  child_id: childIdSchema,
});

export const activityListQuerySchema = z.object({
  range: z.enum(["week", "month"]).default("week"),
  child_id: z.string().uuid().optional(),
});

export const stepsLogSchema = z.object({
  logged_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "logged_date must be YYYY-MM-DD"),
  steps: z.coerce.number().int().min(0).max(200000),
  step_goal: z.coerce.number().int().min(1000).max(100000).optional(),
  child_id: childIdSchema,
});

export const stepsQuerySchema = z.object({
  logged_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "logged_date must be YYYY-MM-DD")
    .optional(),
  child_id: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getOwnerUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError(ErrorCodes.TENANT_SCOPE_VIOLATION);
  return user.id;
}

/** A provided child_id must belong to one of the caller's child_access rows. */
async function assertChildAccess(childId: string | null | undefined): Promise<string | null> {
  if (!childId) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError(ErrorCodes.TENANT_SCOPE_VIOLATION);
  const { data, error } = await supabase
    .from("child_access")
    .select("child_id")
    .eq("user_id", user.id)
    .eq("child_id", childId)
    .limit(1);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  if (!data || data.length === 0)
    throw new ApiError(ErrorCodes.TENANT_SCOPE_VIOLATION);
  return childId;
}

function toLocalDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return toLocalDay(d.toISOString());
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDay(d.toISOString());
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------
export async function listActivity(
  range: "week" | "month",
  childId?: string,
): Promise<{ workouts: Workout[]; summary: ActivitySummary }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const child = await assertChildAccess(childId);

  const since = range === "week" ? daysAgo(6) : daysAgo(29);
  let query = supabase
    .from("workouts")
    .select("*")
    .eq("owner_user_id", ownerId)
    .gte("logged_at", `${since}T00:00:00.000Z`)
    .order("logged_at", { ascending: false })
    .limit(200);
  query = child === null ? query.is("child_id", null) : query.eq("child_id", child);

  const { data, error } = await query;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  const workouts = (data ?? []) as Workout[];

  // This week = the 7 days ending today.
  const thisWeekDays = new Set(Array.from({ length: 7 }, (_, i) => daysAgo(i)));
  let workoutsThisWeek = 0;
  let minutesThisWeek = 0;
  let milesThisWeek = 0;

  const weekBuckets = new Map<string, WeekTotal>();
  for (let i = 0; i < 6; i++) {
    const ws = mondayOf(daysAgo(i * 7));
    if (!weekBuckets.has(ws)) weekBuckets.set(ws, { week_start: ws, workouts: 0, minutes: 0, miles: 0 });
  }

  for (const w of workouts) {
    const day = toLocalDay(w.logged_at);
    const mins = w.duration_min;
    const miles = Number(w.distance_mi) || 0;
    if (thisWeekDays.has(day)) {
      workoutsThisWeek += 1;
      minutesThisWeek += mins;
      milesThisWeek += miles;
    }
    const bucket = weekBuckets.get(mondayOf(day));
    if (bucket) {
      bucket.workouts += 1;
      bucket.minutes += mins;
      bucket.miles += Math.round((bucket.miles + miles) * 100) / 100;
    }
  }

  // Streak: consecutive calendar days with ≥1 workout, ending today or yesterday.
  let dayQuery = supabase
    .from("workouts")
    .select("logged_at, child_id")
    .eq("owner_user_id", ownerId)
    .gte("logged_at", `${daysAgo(60)}T00:00:00.000Z`)
    .order("logged_at", { ascending: false })
    .limit(500);
  dayQuery = child === null ? dayQuery.is("child_id", null) : dayQuery.eq("child_id", child);
  const { data: dayRows, error: dayErr } = await dayQuery;
  if (dayErr) throw new ApiError(mapDbError(dayErr, crypto.randomUUID()));
  const streak = computeStreak(
    ((dayRows ?? []) as { logged_at: string }[]).map((r) => r.logged_at),
  );

  const summary: ActivitySummary = {
    workouts_this_week: workoutsThisWeek,
    minutes_this_week: minutesThisWeek,
    miles_this_week: Math.round(milesThisWeek * 100) / 100,
    streak_days: streak,
    week_totals: [...weekBuckets.values()].sort((a, b) =>
      a.week_start < b.week_start ? 1 : -1,
    ),
  };
  return { workouts, summary };
}

/** Streak: consecutive calendar days with a logged_at entry, ending today or yesterday. */
function computeStreak(loggedAts: string[]): number {
  const days = new Set(loggedAts.map(toLocalDay));
  let streak = 0;
  let cursor = daysAgo(0);
  if (!days.has(cursor)) cursor = daysAgo(1); // allow logging later today
  if (!days.has(cursor)) return 0;
  while (days.has(cursor)) {
    streak += 1;
    const d = new Date(`${cursor}T12:00:00`);
    d.setDate(d.getDate() - 1);
    cursor = toLocalDay(d.toISOString());
  }
  return streak;
}

export async function createWorkout(
  input: z.infer<typeof workoutCreateSchema>,
): Promise<{ workout: Workout }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const child = await assertChildAccess(input.child_id);

  const { data, error } = await supabase
    .from("workouts")
    .insert({
      owner_user_id: ownerId,
      child_id: child,
      type: input.type,
      duration_min: input.duration_min,
      distance_mi: input.distance_mi ?? null,
      calories: input.calories ?? null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      logged_at: input.logged_at ?? new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { workout: data as Workout };
}

export async function deleteWorkout(workoutId: string): Promise<{ ok: true }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();

  const { error } = await supabase
    .from("workouts")
    .delete()
    .eq("id", workoutId)
    .eq("owner_user_id", ownerId);

  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Steps (manual logging; device sync arrives in a later phase)
// ---------------------------------------------------------------------------
export async function getSteps(
  loggedDate: string,
  childId?: string,
): Promise<{ today: DaySteps; week: DaySteps[] }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const child = await assertChildAccess(childId);

  const start = daysAgo(6);
  let query = supabase
    .from("activity_steps")
    .select("logged_date, steps, step_goal")
    .eq("owner_user_id", ownerId)
    .gte("logged_date", start)
    .order("logged_date", { ascending: true });
  query = child === null ? query.is("child_id", null) : query.eq("child_id", child);

  const { data, error } = await query;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  const rows = (data ?? []) as DaySteps[];

  const byDay = new Map(rows.map((r) => [r.logged_date, r]));
  // Carry the most recent goal forward so the target persists across days.
  let lastGoal = 8000;
  const week: DaySteps[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = daysAgo(i);
    const row = byDay.get(day);
    if (row) lastGoal = row.step_goal;
    week.push({ logged_date: day, steps: row?.steps ?? 0, step_goal: row?.step_goal ?? lastGoal });
  }
  const today = week[week.length - 1];
  const requested = byDay.get(loggedDate);
  return {
    today: requested ?? { logged_date: loggedDate, steps: 0, step_goal: lastGoal },
    week,
  };
}

export async function logSteps(
  input: z.infer<typeof stepsLogSchema>,
): Promise<{ day: DaySteps }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const child = await assertChildAccess(input.child_id);

  // Select-then-write: PostgREST upsert on a nullable child_id unique index is
  // unreliable, and races here are harmless (same user, same device).
  let existingQuery = supabase
    .from("activity_steps")
    .select("id, step_goal")
    .eq("owner_user_id", ownerId)
    .eq("logged_date", input.logged_date)
    .limit(1);
  existingQuery =
    child === null ? existingQuery.is("child_id", null) : existingQuery.eq("child_id", child);
  const { data: existing, error: selErr } = await existingQuery;
  if (selErr) throw new ApiError(mapDbError(selErr, crypto.randomUUID()));

  const row = existing?.[0] as { id: string; step_goal: number } | undefined;
  const goal = input.step_goal ?? row?.step_goal ?? 8000;

  if (row) {
    const { error } = await supabase
      .from("activity_steps")
      .update({ steps: input.steps, step_goal: goal })
      .eq("id", row.id);
    if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  } else {
    const { error } = await supabase.from("activity_steps").insert({
      owner_user_id: ownerId,
      child_id: child,
      logged_date: input.logged_date,
      steps: input.steps,
      step_goal: goal,
    });
    if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  }

  return {
    day: { logged_date: input.logged_date, steps: input.steps, step_goal: goal },
  };
}
