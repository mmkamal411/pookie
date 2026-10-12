// GET /api/v1/family/claims/incoming — claims awaiting the CALLER's decision.
// The submit_parent_claim RPC (049) routes each claim to exactly one approver
// (Parent A for <13, the teen for 13+); this lists the claims where
// approver_user_id = me. The claim form data (name/DOB/email) is never echoed
// back — the approver acts on the request, not on re-displayed PII.
import { handleRoute } from "@/server/rest";
import { listIncomingClaims } from "@/server/services/family-links";

export const GET = handleRoute(async () => {
  return listIncomingClaims();
});
