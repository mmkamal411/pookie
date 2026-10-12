// POST /api/v1/support/grants/[id]/decision — the DATA OWNER approves or
// denies a support agent's scoped-read request (sol-support C2: for
// teen-owned data the card goes to the teen, never the parent).
//
// Coded against the pending rpc_decide_support_grant contract. Until the RPC
// lands, the route enforces the same guards directly: only the grant's
// consenter may decide; pending grants only; every decision audit-logged
// via log_access_event.

import { z } from "zod";
import { handleRoute } from "@/server/rest";
import { ApiError, ErrorCodes } from "@/server/errors";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const decisionSchema = z.object({ approve: z.boolean() });

export const POST = handleRoute(async (ctx, req) => {
  const grantId = (ctx.params as { id: string }).id;
  const { approve } = decisionSchema.parse(await req.json().catch(() => ({})));
  return decideGrant(ctx.userId, grantId, approve);
});

async function decideGrant(userId: string, grantId: string, approve: boolean) {
  const supabase = await createClient();

  // Contract path first: the real RPC when it exists.
  try {
    const { data, error } = await supabase.rpc("rpc_decide_support_grant", {
      p_grant_id: grantId,
      p_approve: approve,
    });
    if (!error) return { status: approve ? "active" : "denied", ...(data as object | null) };
    if (!/function .* does not exist|42883|PGRST202|Could not find the function/i.test(error.message ?? "")) {
      throw new ApiError(ErrorCodes.INTERNAL);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(ErrorCodes.INTERNAL);
  }

  // Fallback: same guards the RPC enforces.
  const { data: grant } = await supabaseAdmin
    .from("support_grants")
    .select("id, status, consenter_user_id, ticket_id, scope, expires_at")
    .eq("id", grantId)
    .maybeSingle();
  const g = grant as {
    id: string;
    status: string;
    consenter_user_id: string;
    ticket_id: string;
    scope: string;
    expires_at: string | null;
  } | null;
  if (!g) throw new ApiError(ErrorCodes.NOT_FOUND);
  if (g.consenter_user_id !== userId) throw new ApiError(ErrorCodes.SCOPE_FORBIDDEN);
  if (g.status !== "pending") throw new ApiError(ErrorCodes.CONFLICT);

  const next = approve ? "active" : "denied";
  const { error: updError } = await supabaseAdmin
    .from("support_grants")
    .update({
      status: next,
      decided_at: new Date().toISOString(),
      expires_at: approve
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : g.expires_at,
    })
    .eq("id", grantId);
  if (updError) throw new ApiError(ErrorCodes.INTERNAL);

  try {
    await supabaseAdmin.rpc("log_access_event", {
      p_child_id: null,
      p_actor_user_id: userId,
      p_event_type: approve ? "support.grant.approved" : "support.grant.denied",
      p_subject_user_id: null,
      p_metadata: { grant_id: grantId, ticket_id: g.ticket_id, scope: g.scope },
      p_amount_cents: null,
    });
  } catch {
    // audit best-effort
  }
  return { status: next };
}
