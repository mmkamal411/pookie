// POST /api/v1/family/claims/[claimId]/decide
// Approve or reject a pending claim via decide_parent_claim (049). No
// auto-grant ever — the designated approver (Parent A for <13, the teen for
// 13+) always decides; the RPC authorizes via approver_user_id, re-checks
// the court-order flag at decision time, and writes the child_access row on
// approval (granted_by 'child' for teen approvals).
import { z } from "zod";
import { handleRoute } from "@/server/rest";
import { decideClaim } from "@/server/services/family-links";

export const POST = handleRoute<{ claimId: string }>(async (ctx, req) => {
  const params = z.object({ claimId: z.string().uuid() }).parse(ctx.params);
  const { decision } = z
    .object({ decision: z.enum(["approved", "rejected"]) })
    .parse(await req.json());
  return decideClaim(params.claimId, decision);
});
