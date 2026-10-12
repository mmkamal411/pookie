// /api/v1/household/insurance — Insurance Policy Tracker (Phase1-Insurance).
// Framework-free business logic; household-anchored (owner_user_id); RLS via
// is_household_member(). The policy_number column stores a MASKED display
// value only — full numbers are masked server-side here and never persisted.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, ErrorCodes, mapDbError } from "@/server/errors";

export type PolicyType = "auto" | "home" | "health" | "life" | "renter";
export type PremiumFrequency = "monthly" | "quarterly" | "semiannual" | "annual";

export interface InsurancePolicy {
  id: string;
  owner_user_id: string;
  type: PolicyType;
  provider: string;
  policy_number: string | null;
  premium_amount: string | null;
  premium_frequency: PremiumFrequency;
  renewal_date: string | null;
  coverage_summary: string | null;
  agent_name: string | null;
  agent_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export const policyTypeSchema = z.enum(["auto", "home", "health", "life", "renter"]);
export const premiumFrequencySchema = z.enum(["monthly", "quarterly", "semiannual", "annual"]);

export const policyCreateSchema = z.object({
  type: policyTypeSchema,
  provider: z.string().min(1).max(200),
  policy_number: z.string().max(64).optional(), // masked server-side; full never persisted
  premium_amount: z.number().positive().max(99999999).optional(),
  premium_frequency: premiumFrequencySchema.default("annual"),
  renewal_date: z.string().regex(dateRe).optional(),
  coverage_summary: z.string().max(2000).optional(),
  agent_name: z.string().max(200).optional(),
  agent_phone: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
});

export const policyPutSchema = policyCreateSchema;

function maskPolicyNumber(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("••••")) return trimmed; // already masked
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "••••";
  return `••••${digits.slice(-4)}`;
}

async function getOwnerUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError(ErrorCodes.TENANT_SCOPE_VIOLATION);
  return user.id;
}

function toRow(input: z.infer<typeof policyCreateSchema>, ownerId: string) {
  return {
    owner_user_id: ownerId,
    type: input.type,
    provider: input.provider.trim(),
    policy_number: maskPolicyNumber(input.policy_number),
    premium_amount: input.premium_amount ?? null,
    premium_frequency: input.premium_frequency,
    renewal_date: input.renewal_date ?? null,
    coverage_summary: input.coverage_summary?.trim() || null,
    agent_name: input.agent_name?.trim() || null,
    agent_phone: input.agent_phone?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

export async function listPolicies(): Promise<{ policies: InsurancePolicy[] }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const { data, error } = await supabase
    .from("insurance_policies")
    .select("*")
    .eq("owner_user_id", ownerId)
    .order("renewal_date", { ascending: true, nullsFirst: false })
    .limit(100);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { policies: (data ?? []) as InsurancePolicy[] };
}

export async function createPolicy(
  input: z.infer<typeof policyCreateSchema>,
): Promise<{ policy: InsurancePolicy }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const { data, error } = await supabase
    .from("insurance_policies")
    .insert(toRow(input, ownerId))
    .select()
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { policy: data as InsurancePolicy };
}

export async function putPolicy(
  id: string,
  input: z.infer<typeof policyPutSchema>,
): Promise<{ policy: InsurancePolicy }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const { data, error } = await supabase
    .from("insurance_policies")
    .update(toRow(input, ownerId))
    .eq("id", id)
    .eq("owner_user_id", ownerId)
    .select()
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { policy: data as InsurancePolicy };
}

export async function deletePolicy(id: string): Promise<{ deleted: boolean }> {
  const supabase = await createClient();
  const ownerId = await getOwnerUserId();
  const { error } = await supabase
    .from("insurance_policies")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", ownerId);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { deleted: true };
}
