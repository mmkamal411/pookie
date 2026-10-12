// FR-AUTH-011 — second-parent linking (D5: OPEN SIGNUP).
//
// Squad 3 tech-lead consolidation (2026-10-12): this module is the WIRED
// service contract (routes under /api/v1/family/* call these functions).
// All security-critical logic lives in SECURITY DEFINER RPCs (migration
// 049_second_parent_claim.sql) — the matching, rate limits, lockouts, and
// uniform anti-oracle responses run inside the database, never in
// caller-JWT queries. This module adapts the wired shapes onto those RPCs.
// Identity comes from the session (createClient) — the RPCs authorize
// internally (approver_user_id, parent-role membership, safe_auth_uid).
//
// Two paths:
//   A. Claim flow: verified sign-in → child name/DOB + creating-parent email +
//      perjury-style + custody attestations → approval request to Parent A (<13)
//      or the teen (13+) → connected on approval. Uniform responses everywhere;
//      no enumeration oracle. `court_order_restriction` disables self-serve.
//   B. Invite-from-inside: Parent A generates an unguessable deep link / QR
//      (7-day TTL, single use, hashed codes, atomic redeem); Parent B redeems.
//
// NOTE on the previous draft: matching children via caller-JWT SELECTs on the
// children table could not work — RLS restricts children to the caller's own
// tenants (useless for claiming) or would be an enumeration oracle if
// permissive. The RPC design fixes this structurally.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, ErrorCodes, failWith, mapDbError } from "@/server/errors";
import {
  submitClaim,
  decideClaim as decideClaimRpc,
  createInvite as createInviteRpc,
  redeemInvite as redeemInviteRpc,
  previewInvite as previewInviteRpc,
} from "./parent-claim";

// ---------------------------------------------------------------------------
// Claim flow
// ---------------------------------------------------------------------------

export const claimSchema = z.object({
  child_name: z.string().min(2).max(120),
  child_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  creating_parent_email: z.string().email().max(200),
  perjury_attested: z.literal(true, {
    message: "The guardian attestation is required.",
  }),
  custody_disclosed: z.boolean(),
  custody_details: z.string().max(1000).optional(),
});

export interface ClaimRecord {
  id: string;
  status: "pending" | "approved" | "rejected" | "human_review";
  approver: "parent_a" | "teen" | null;
  created_at: string;
  decided_at: string | null;
  escalated: boolean;
}

type ParentClaimRow = {
  id: string;
  status: string;
  approver_kind: string | null;
  created_at: string;
  decided_at: string | null;
  escalated_at: string | null;
};

function toClaimRecord(r: ParentClaimRow): ClaimRecord {
  const created = new Date(r.created_at).getTime();
  const stalePending = Date.now() - created > 14 * 24 * 60 * 60 * 1000;
  // Never reveal the 'locked' (30-day post-rejection) state — it renders as
  // an ordinary pending claim (no oracle).
  const status: ClaimRecord["status"] =
    r.status === "approved" || r.status === "rejected"
      ? r.status
      : r.status === "needs_review" || r.status === "blocked_court_order"
        ? "human_review"
        : "pending";
  return {
    id: r.id,
    status,
    approver: r.approver_kind === "teen" ? "teen" : r.approver_kind === "parent_a" ? "parent_a" : null,
    created_at: r.created_at,
    decided_at: r.decided_at,
    escalated: r.status === "escalated" || (status === "pending" && stalePending),
  };
}

/**
 * Submit a second-parent claim. ALWAYS returns the same uniform shape —
 * whether or not a matching child exists — so the endpoint can't be probed
 * for children's existence (no enumeration oracle). The RPC performs the
 * silent server-side match, rate limits (5/hr, 20/day), 30-day lockouts,
 * and approver routing (Parent A <13, teen 13+).
 */
export async function createFamilyClaim(
  input: z.infer<typeof claimSchema>,
): Promise<{ received: true; claim_id: string }> {
  const attestationText =
    "I attest under penalty of perjury that I am this child's parent or legal guardian. " +
    (input.custody_details?.trim() ? `Disclosure: ${input.custody_details.trim()}` : "No additional disclosures.");
  const custodyAttestation = input.custody_disclosed
    ? input.custody_details?.trim() || "Court orders disclosed — details provided to reviewer."
    : "No court orders limiting access disclosed.";
  const res = await submitClaim({
    child_name: input.child_name,
    child_dob: input.child_dob,
    creating_parent_email: input.creating_parent_email,
    perjury_attestation: true,
    attestation_text: attestationText,
    custody_attestation: custodyAttestation,
  });
  return { received: true, claim_id: res.claim_id };
}

/** The caller's own claims (waiting / approved / rejected states). */
export async function listMyClaims(): Promise<{ claims: ClaimRecord[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parent_claims")
    .select("id, status, approver_kind, created_at, decided_at, escalated_at")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { claims: ((data ?? []) as ParentClaimRow[]).map(toClaimRecord) };
}

/**
 * Incoming claims awaiting the CALLER's decision. The submit_parent_claim RPC
 * (049) routes each claim to exactly one approver (Parent A for <13, the teen
 * for 13+); this lists the claims where approver_user_id = me. The claim form
 * data (name/DOB/email) is never echoed back — the approver acts on the
 * request, not on re-displayed PII.
 */
export async function listIncomingClaims(): Promise<{ claims: ClaimRecord[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  const { data, error } = await supabase
    .from("parent_claims")
    .select("id, status, approver_kind, created_at, decided_at, escalated_at")
    .eq("approver_user_id", user.id)
    .in("status", ["pending", "escalated"])
    .order("created_at", { ascending: true });
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  return { claims: ((data ?? []) as ParentClaimRow[]).map(toClaimRecord) };
}

/**
 * Decide a claim. Approval creates the child_access row (no auto-grant ever —
 * a human approver always decides). granted_by reflects who approved:
 * 'parent' for Parent A, 'child' for the teen (child-as-access-authority).
 * The RPC authorizes via approver_user_id and re-checks the court-order flag.
 */
export async function decideClaim(
  claimId: string,
  decision: "approved" | "rejected",
): Promise<{ decided: boolean }> {
  const res = await decideClaimRpc(claimId, decision);
  return { decided: res.decided };
}

// ---------------------------------------------------------------------------
// Invite-from-inside (alternative fast path)
// ---------------------------------------------------------------------------

export interface FamilyInvite {
  token: string;
  expires_at: string;
}

/**
 * Parent A generates a second-parent invite for one child. Children with
 * court_order_restriction set are excluded — self-serve linking is disabled
 * entirely for them (D5 custody posture: STAY OUT).
 */
export async function createFamilyInvite(childId: string): Promise<FamilyInvite> {
  const { code, expiresAt } = await createInviteRpc(childId);
  return { token: code, expires_at: expiresAt };
}

/**
 * Public invite preview — zero child PII before authentication
 * (FR-AUTH-009): only the inviter's display name + expiry.
 */
export async function previewFamilyInvite(
  token: string,
): Promise<{ inviter_name: string | null; expires_at: string }> {
  return previewInviteRpc(token);
}

/** Accept an invite (signed-in Parent B). Single use; uniform failure copy. */
export async function acceptFamilyInvite(token: string): Promise<{ child_id: string }> {
  const { childId } = await redeemInviteRpc(token);
  return { child_id: childId };
}
