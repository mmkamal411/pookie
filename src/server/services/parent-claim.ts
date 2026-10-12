// Second-parent onboarding service — FR-AUTH-011 (D5 revised: OPEN SIGNUP v1).
//
// Two paths, both real:
//   (a) invite-from-inside: Parent A generates a deep link/QR (createInvite),
//       Parent B redeems (redeemInvite). Fastest path, OPTIONAL not required.
//   (b) corroborated claim: verified sign-in + child name/DOB + creating-parent
//       email + perjury-style attestation + custody attestation (submitClaim).
//       NEVER auto-grants: approval routes to Parent A (<13) or the teen (13+).
//
// Anti-enumeration: submitClaim returns a UNIFORM response regardless of match
// (the RPC never reveals match state); lookups are rate-limited (5/hr, 20/day)
// inside SECURITY DEFINER. 14-day unresponsive → escalated (human-review queue).
// 30-day lockout after rejection. court_order_restriction disables self-serve.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, ErrorCodes, failWith, mapDbError } from "@/server/errors";
import { requireParentRole } from "@/server/services/school";

export const CLAIM_UNIFORM_MESSAGE =
  "If this child is in Pookie, we have notified the parent on record.";

export const claimSubmitSchema = z.object({
  child_name: z.string().min(1).max(200),
  child_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "child_dob must be YYYY-MM-DD"),
  creating_parent_email: z.string().email().max(320),
  perjury_attestation: z.literal(true, {
    message: "The perjury-style attestation is required.",
  }),
  attestation_text: z.string().min(20).max(2000),
  custody_attestation: z.string().min(10).max(2000),
});

/** Parent A generates an invite (deep link / QR payload). */
export async function createInvite(childId: string): Promise<{
  code: string;
  inviteUrl: string;
  expiresAt: string;
}> {
  await requireParentRole(childId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_parent_invite", { p_child_id: childId });
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  const row = (Array.isArray(data) ? data[0] : data) as { code: string; expires_at: string };
  if (!row?.code) failWith(ErrorCodes.INTERNAL);
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://pookie.pages.dev").replace(/\/$/, "");
  return {
    code: row.code,
    inviteUrl: `${baseUrl}/invite/${row.code}`,
    expiresAt: row.expires_at,
  };
}

/** Parent B redeems an invite code → linked. Uniform failure on bad codes. */
export async function redeemInvite(code: string): Promise<{ childId: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_parent_invite", {
    p_code: code.trim(),
  });
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  if (!data) failWith(ErrorCodes.INVITE_NOT_FOUND);
  return { childId: data as string };
}

/**
 * Submit a corroborated claim. ALWAYS returns the uniform response —
 * the RPC never reveals whether the child matched, was court-restricted,
 * or is in lockout. claim_id is the claimant's own row id (reveals nothing
 * about match state).
 */
export async function submitClaim(input: z.infer<typeof claimSubmitSchema>): Promise<{
  submitted: boolean;
  message: string;
  claim_id: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_parent_claim", {
    p_child_name: input.child_name.trim(),
    p_child_dob: input.child_dob,
    p_creating_parent_email: input.creating_parent_email.trim(),
    p_perjury_attestation: true,
    p_attestation_text: input.attestation_text.trim(),
    p_custody_attestation: input.custody_attestation.trim(),
  });
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  const row = data as { submitted: boolean; message: string; claim_id: string };
  if (!row?.claim_id) failWith(ErrorCodes.INTERNAL);
  return { submitted: row.submitted ?? true, message: row.message ?? CLAIM_UNIFORM_MESSAGE, claim_id: row.claim_id };
}

/**
 * Public invite preview (FR-AUTH-009): zero child PII before authentication.
 * Uniform failure on invalid/expired/used codes.
 */
export async function previewInvite(code: string): Promise<{ inviter_name: string | null; expires_at: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_parent_invite", { p_code: code.trim() });
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  const row = (Array.isArray(data) ? data[0] : data) as {
    inviter_name: string | null;
    expires_at: string;
  };
  if (!row?.expires_at) failWith(ErrorCodes.INVITE_NOT_FOUND);
  return { inviter_name: row.inviter_name ?? null, expires_at: row.expires_at };
}

/** Designated approver (Parent A or teen) approves/rejects. Never auto-grants. */
export async function decideClaim(
  claimId: string,
  decision: "approved" | "rejected",
): Promise<{ decided: boolean; decision: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_parent_claim", {
    p_claim_id: claimId,
    p_decision: decision,
  });
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return data as { decided: boolean; decision: string };
}

/** Claims the caller submitted (status visible; routing internals stay server-side). */
export async function listMyClaims() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parent_claims")
    .select("id, status, created_at, decided_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { claims: data ?? [] };
}

/** Approver inbox: claims routed to the caller + unseen notifications. */
export async function listClaimApprovals() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parent_claims")
    .select("id, status, created_at, approver_kind, child_name, child_dob")
    .eq("approver_user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .in("status", ["pending", "escalated"])
    .order("created_at", { ascending: false });
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { claims: data ?? [] };
}

/** Nightly worker: escalate claims pending > 14 days → human-review queue. */
export async function runClaimEscalation(): Promise<{ escalated: number }> {
  const { data, error } = await supabaseAdmin.rpc("escalate_stale_claims");
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { escalated: (data as number) ?? 0 };
}
