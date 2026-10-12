// Family Task System — framework-free business logic (Squad Value).
// Household-anchored (owner_user_id); RLS via is_household_member().
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, ErrorCodes, mapDbError } from "@/server/errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface FamilyTask {
  id: string;
  owner_user_id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  assigned_to: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "done" | "snoozed";
  recurrence: "daily" | "weekly" | "monthly" | null;
  category: string | null;
  source: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export const taskCreateSchema = z.object({
  title: z.string().min(1).max(280),
  notes: z.string().max(2000).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "due_date must be YYYY-MM-DD").optional(),
  due_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "due_time must be HH:MM").optional(),
  assigned_to: z.string().max(100).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  recurrence: z.enum(["daily", "weekly", "monthly"]).optional(),
  category: z.string().max(50).optional(),
  source: z.string().max(50).default("manual"),
});

export const taskPatchSchema = z.object({
  title: z.string().min(1).max(280).optional(),
  notes: z.string().max(2000).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  due_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  assigned_to: z.string().max(100).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  recurrence: z.enum(["daily", "weekly", "monthly"]).nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  status: z.enum(["open", "done", "snoozed"]).optional(),
});

export const taskListQuerySchema = z.object({
  status: z.enum(["open", "done", "snoozed", "all"]).default("open"),
  due: z.enum(["today", "overdue", "week", "all"]).default("all"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getOwnerUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError(ErrorCodes.TENANT_SCOPE_VIOLATION);
  return user.id;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------
export async function listTasks(
  status: string = "open",
  due: string = "all",
): Promise<{ tasks: FamilyTask[] }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();

  let query = supabase
    .from("family_tasks")
    .select("*")
    .eq("owner_user_id", ownerId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (status !== "all") query = query.eq("status", status);

  const today = new Date().toISOString().slice(0, 10);
  if (due === "today") query = query.eq("due_date", today);
  else if (due === "overdue") query = query.lt("due_date", today).eq("status", "open");
  else if (due === "week") {
    const weekOut = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    query = query.gte("due_date", today).lte("due_date", weekOut);
  }

  const { data, error } = await query;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { tasks: (data ?? []) as FamilyTask[] };
}

export async function createTask(
  input: z.infer<typeof taskCreateSchema>,
): Promise<{ task: FamilyTask }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("family_tasks")
    .insert({
      owner_user_id: ownerId,
      title: input.title,
      notes: input.notes ?? null,
      due_date: input.due_date ?? null,
      due_time: input.due_time ?? null,
      assigned_to: input.assigned_to ?? null,
      priority: input.priority,
      recurrence: input.recurrence ?? null,
      category: input.category ?? null,
      source: input.source,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { task: data as FamilyTask };
}

export async function patchTask(
  taskId: string,
  input: z.infer<typeof taskPatchSchema>,
): Promise<{ task: FamilyTask }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();

  const patch: Record<string, unknown> = { ...input };
  // Completing a task stamps completed_at; reopening clears it.
  if (input.status === "done" && !("completed_at" in patch)) {
    patch.completed_at = new Date().toISOString();
    const { data: { user } } = await supabase.auth.getUser();
    patch.completed_by = user?.id ?? null;
  } else if (input.status === "open") {
    patch.completed_at = null;
    patch.completed_by = null;
  }

  const { data, error } = await supabase
    .from("family_tasks")
    .update(patch)
    .eq("id", taskId)
    .eq("owner_user_id", ownerId)
    .select("*")
    .single();

  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  if (!data) throw new ApiError(ErrorCodes.NOT_FOUND);

  const task = data as FamilyTask;

  // Recurrence: completing a recurring task spawns the next occurrence.
  if (input.status === "done" && task.recurrence && task.due_date) {
    const { data: nextDue } = await supabase.rpc("family_tasks_next_due", {
      p_due: task.due_date,
      p_recurrence: task.recurrence,
    });
    if (nextDue) {
      await supabase.from("family_tasks").insert({
        owner_user_id: ownerId,
        title: task.title,
        notes: task.notes,
        due_date: nextDue as string,
        due_time: task.due_time,
        assigned_to: task.assigned_to,
        priority: task.priority,
        recurrence: task.recurrence,
        category: task.category,
        source: task.source,
      });
    }
  }

  return { task };
}

export async function deleteTask(taskId: string): Promise<{ ok: true }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();

  const { error } = await supabase
    .from("family_tasks")
    .delete()
    .eq("id", taskId)
    .eq("owner_user_id", ownerId);

  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { ok: true };
}

/** Count of open tasks due today or overdue — for the Today digest. */
export async function getTaskDigest(): Promise<{
  dueToday: number;
  overdue: number;
  urgent: FamilyTask[];
}> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const today = new Date().toISOString().slice(0, 10);

  const { data: dueToday } = await supabase
    .from("family_tasks").select("id", { count: "exact" })
    .eq("owner_user_id", ownerId).eq("status", "open").eq("due_date", today);

  const { data: overdue } = await supabase
    .from("family_tasks").select("id", { count: "exact" })
    .eq("owner_user_id", ownerId).eq("status", "open").lt("due_date", today);

  const { data: urgent } = await supabase
    .from("family_tasks").select("*")
    .eq("owner_user_id", ownerId).eq("status", "open").eq("priority", "urgent")
    .order("due_date", { ascending: true }).limit(5);

  return {
    dueToday: dueToday?.length ?? 0,
    overdue: overdue?.length ?? 0,
    urgent: (urgent ?? []) as FamilyTask[],
  };
}
