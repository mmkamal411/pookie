// Squad Cradle — verifiable parental consent for under-13 child login.
//
// COPPA requires verifiable parental consent before an under-13 child gets
// an online account. The default stays CLOSED (consume_invite raises
// under_13_no_login). This service wraps the 076 RPCs: a parent records
// HOW consent was verified; the invite gate opens only while a valid
// (non-revoked) consent exists.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ErrorCodes, failWith } from "@/server/errors";

export const grantConsentSchema = z.object({
  method: z.string().trim().min(1).max(80),
  detail: z.record(z.string(), z.unknown()).optional(),
});

export interface ParentalConsent {
  id: string;
  child_id: string;
  consenting_parent_user_id: string;
  consent_type: string;
  method: string;
  detail: Record<string, unknown>;
  granted_at: string;
  revoked_at: string | null;
}

/** Parent records verifiable consent for their child's login. */
export async function grantConsent(
  userId: string,
  childId: string,
  input: z.infer<typeof grantConsentSchema>,
): Promise<{ consent_id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("grant_parental_consent", {
    p_child_id: childId,
    p_method: input.method,
    p_detail: input.detail ?? {},
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("parent_membership_required")) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
    if (msg.includes("consent_method_required")) failWith(ErrorCodes.VALIDATION_FAILED);
    failWith(ErrorCodes.INTERNAL);
  }
  // The RPC itself verifies the parent role; userId is asserted by the route.
  void userId;
  return { consent_id: data as string };
}

/** Parent revokes consent. Blocks future invite consumes. */
export async function revokeConsent(
  userId: string,
  childId: string,
): Promise<{ revoked: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_parental_consent", {
    p_child_id: childId,
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("parent_membership_required")) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
    failWith(ErrorCodes.INTERNAL);
  }
  void userId;
  return { revoked: data === true };
}

/** Current consent state for a child (tenant parents + the child). */
export async function getConsent(childId: string): Promise<{ consent: ParentalConsent | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parental_consents")
    .select(
      "id, child_id, consenting_parent_user_id, consent_type, method, detail, granted_at, revoked_at",
    )
    .eq("child_id", childId)
    .eq("consent_type", "child_login")
    .order("granted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // RLS: tenant parents + the child can read. Others get null (not an error).
  if (error) return { consent: null };
  return { consent: (data as ParentalConsent | null) ?? null };
}
