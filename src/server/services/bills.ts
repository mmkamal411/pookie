// Bill Tracker — framework-free business logic (Squad Value).
// Household-anchored (owner_user_id); RLS via is_household_member().
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, ErrorCodes, mapDbError } from "@/server/errors";

export interface Bill {
  id: string;
  owner_user_id: string;
  name: string;
  payee: string | null;
  amount: string | null;
  due_date: string | null;
  recurrence: "once" | "monthly" | "quarterly" | "yearly" | null;
  category: string | null;
  status: "unpaid" | "paid" | "overdue" | "autopay";
  notes: string | null;
  last_paid_at: string | null;
  created_at: string;
}

export const billCreateSchema = z.object({
  name: z.string().min(1).max(200),
  payee: z.string().max(200).optional(),
  amount: z.number().positive().max(99999999).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recurrence: z.enum(["once", "monthly", "quarterly", "yearly"]).optional(),
  category: z.string().max(50).optional(),
  status: z.enum(["unpaid", "paid", "overdue", "autopay"]).default("unpaid"),
  notes: z.string().max(1000).optional(),
});

export const billPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  payee: z.string().max(200).nullable().optional(),
  amount: z.number().positive().max(99999999).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  recurrence: z.enum(["once", "monthly", "quarterly", "yearly"]).nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  status: z.enum(["unpaid", "paid", "overdue", "autopay"]).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

async function getOwnerUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError(ErrorCodes.TENANT_SCOPE_VIOLATION);
  return user.id;
}

export async function listBills(status = "all"): Promise<{ bills: Bill[] }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  let query = supabase
    .from("bills")
    .select("*")
    .eq("owner_user_id", ownerId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(100);
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { bills: (data ?? []) as Bill[] };
}

export async function createBill(input: z.infer<typeof billCreateSchema>): Promise<{ bill: Bill }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const { data, error } = await supabase
    .from("bills")
    .insert({
      owner_user_id: ownerId,
      name: input.name,
      payee: input.payee ?? null,
      amount: input.amount ?? null,
      due_date: input.due_date ?? null,
      recurrence: input.recurrence ?? null,
      category: input.category ?? null,
      status: input.status,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { bill: data as Bill };
}

export async function patchBill(
  billId: string,
  input: z.infer<typeof billPatchSchema>,
): Promise<{ bill: Bill }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const patch: Record<string, unknown> = { ...input };
  if (input.status === "paid") patch.last_paid_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("bills")
    .update(patch)
    .eq("id", billId)
    .eq("owner_user_id", ownerId)
    .select("*")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  if (!data) throw new ApiError(ErrorCodes.NOT_FOUND);
  return { bill: data as Bill };
}

export async function deleteBill(billId: string): Promise<{ ok: true }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const { error } = await supabase
    .from("bills")
    .delete()
    .eq("id", billId)
    .eq("owner_user_id", ownerId);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { ok: true };
}

/** Bills due within the next N days (default 7) — for reminders and the Today digest. */
export async function getBillsDueSoon(days = 7): Promise<{ bills: Bill[] }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("owner_user_id", ownerId)
    .in("status", ["unpaid", "overdue"])
    .gte("due_date", today)
    .lte("due_date", cutoff)
    .order("due_date", { ascending: true });
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { bills: (data ?? []) as Bill[] };
}
