// Background AI — household signal collector.
// Server-only (uses the service-role client; RLS is bypassed so every query
// carries an explicit owner_user_id). Each source is read defensively: a
// source that fails yields a zero-signal, never a failed cycle.

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { BillSignal, HouseholdSignals } from "./types";

const MS_PER_DAY = 86_400_000;
const DEFAULT_QUIET_HOURS = { start: "22:00", end: "07:00" };

interface BillRow {
  id: string;
  name: string;
  payee: string | null;
  amount: string | number | null;
  due_date: string | null;
  status: "unpaid" | "paid" | "overdue" | "autopay";
}

function toBillSignal(row: BillRow): BillSignal {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let daysUntilDue: number | null = null;
  if (row.due_date) {
    const [y, m, d] = row.due_date.split("-").map(Number);
    const due = new Date(y, m - 1, d);
    daysUntilDue = Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);
  }
  return {
    id: row.id,
    name: row.name,
    payee: row.payee,
    amount: row.amount == null ? null : Number(row.amount),
    dueDate: row.due_date,
    daysUntilDue,
    status: row.status,
  };
}

async function safe<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** All household anchors that have any bill activity — the cycle's unit. */
export async function listHouseholds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("bills")
    .select("owner_user_id")
    .limit(5000);
  if (error || !data) return [];
  return [...new Set((data as { owner_user_id: string }[]).map((r) => r.owner_user_id))];
}

async function quietHoursFor(ownerUserId: string): Promise<HouseholdSignals["quietHours"]> {
  return safe(DEFAULT_QUIET_HOURS, async () => {
    const { data: kids } = await supabaseAdmin
      .from("children")
      .select("id")
      .eq("parent_user_id", ownerUserId)
      .limit(1);
    const childId = (kids as { id: string }[] | null)?.[0]?.id;
    if (!childId) return DEFAULT_QUIET_HOURS;
    const { data } = await supabaseAdmin
      .from("child_settings")
      .select("notifications")
      .eq("child_id", childId)
      .maybeSingle();
    const prefs = (data as { notifications: { quiet_hours_start?: string; quiet_hours_end?: string } | null } | null)
      ?.notifications;
    return {
      start: prefs?.quiet_hours_start ?? DEFAULT_QUIET_HOURS.start,
      end: prefs?.quiet_hours_end ?? DEFAULT_QUIET_HOURS.end,
    };
  });
}

/** Collect one household's signals. Never throws — failures become zero-signals. */
export async function collectSignals(ownerUserId: string): Promise<HouseholdSignals> {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [bills, tasks, shopping, mail, kids, quietHours] = await Promise.all([
    safe<BillRow[]>([], async () => {
      const { data, error } = await supabaseAdmin
        .from("bills")
        .select("id,name,payee,amount,due_date,status")
        .eq("owner_user_id", ownerUserId)
        .in("status", ["unpaid", "overdue"]);
      if (error) throw error;
      return (data ?? []) as BillRow[];
    }),
    safe<{ due_date: string | null }[]>([], async () => {
      const { data, error } = await supabaseAdmin
        .from("family_tasks")
        .select("due_date")
        .eq("owner_user_id", ownerUserId)
        .eq("status", "open");
      if (error) throw error;
      return (data ?? []) as { due_date: string | null }[];
    }),
    safe(0, async () => {
      const { data: lists } = await supabaseAdmin
        .from("shopping_lists")
        .select("id")
        .eq("owner_user_id", ownerUserId)
        .limit(1);
      const listId = (lists as { id: string }[] | null)?.[0]?.id;
      if (!listId) return 0;
      const { count } = await supabaseAdmin
        .from("shopping_items")
        .select("id", { count: "exact", head: true })
        .eq("list_id", listId)
        .eq("status", "needed");
      return count ?? 0;
    }),
    safe(0, async () => {
      const { count } = await supabaseAdmin
        .from("mail_action_items")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", ownerUserId)
        .eq("status", "open");
      return count ?? 0;
    }),
    safe(0, async () => {
      const { count } = await supabaseAdmin
        .from("children")
        .select("id", { count: "exact", head: true })
        .eq("parent_user_id", ownerUserId);
      return count ?? 0;
    }),
    quietHoursFor(ownerUserId),
  ]);

  const billSignals = bills.map(toBillSignal);
  const overdue = billSignals.filter(
    (b) => b.status === "overdue" || (b.daysUntilDue != null && b.daysUntilDue < 0),
  );
  const overdueIds = new Set(overdue.map((b) => b.id));
  const dueSoon = billSignals.filter((b) => !overdueIds.has(b.id));

  return {
    householdId: ownerUserId,
    collectedAt: new Date().toISOString(),
    billsDueSoon: dueSoon,
    billsOverdue: overdue,
    tasksOverdue: tasks.filter((t) => t.due_date != null && t.due_date < todayStr).length,
    tasksDueToday: tasks.filter((t) => t.due_date === todayStr).length,
    shoppingOpenItems: shopping,
    mailUnreadActionable: mail,
    childrenLinked: kids > 0,
    // School signals arrive in phase 2 with the school watchers; the shape
    // is reserved now so watchers can be added without a migration.
    schoolAttention: [],
    healthActive: false,
    tripUpcoming: false,
    quietHours,
  };
}
