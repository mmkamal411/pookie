// POST /api/v1/family/invites/[token]/accept — Parent B redeems the invite
// via redeem_parent_invite (049). Requires sign-in (handleRoute 401s
// otherwise). Atomic single-use redeem; the RPC writes the child_access row
// (role 'parent', granted_by 'parent'). Invalid, expired, already-used, or
// court-order-blocked codes all fail identically (no enumeration).
import { handleRoute } from "@/server/rest";
import { acceptFamilyInvite } from "@/server/services/family-links";

export const POST = handleRoute<{ token: string }>(async (ctx) => {
  const { token } = ctx.params;
  return acceptFamilyInvite(token);
});
