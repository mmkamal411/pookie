// /api/v1/family/claims — second-parent claim flow (FR-AUTH-011, D5 open signup).
//
// POST — verified sign-in required. Submits a corroborated claim (child
//        name/DOB + creating-parent email + perjury-style + custody
//        attestations) via the submit_parent_claim RPC (049). ALWAYS returns
//        the same uniform shape so the endpoint can't be probed for children's
//        existence (no enumeration oracle). In-DB rate limits (5/hr, 20/day)
//        + 30-day re-request lockout.
//        SEAM: CAPTCHA is not yet wired — add before public launch.
// GET  — the caller's own claims (waiting / approved / rejected states).
import { handleRoute } from "@/server/rest";
import {
  claimSchema,
  createFamilyClaim,
  listMyClaims,
} from "@/server/services/family-links";

export const POST = handleRoute(async (ctx, req) => {
  const body = claimSchema.parse(await req.json());
  // The audit trail records that a claim was filed, never the match outcome.
  return createFamilyClaim(body);
});

export const GET = handleRoute(async () => {
  return listMyClaims();
});
