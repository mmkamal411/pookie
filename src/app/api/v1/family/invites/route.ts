// POST /api/v1/family/invites — Parent A generates a second-parent invite
// (invite-from-inside). Returns an unguessable token + expiry; the client
// builds the deep link and QR. 7-day TTL, single use. Children with
// court_order_restriction set are excluded (403, no details leaked).
import { z } from "zod";
import { handleRoute } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createFamilyInvite } from "@/server/services/family-links";

export const POST = handleRoute(async (ctx, req) => {
  const { child_id } = z
    .object({ child_id: z.string().uuid() })
    .parse(await req.json());
  const tenant = await assertTenant(child_id);
  return createFamilyInvite(tenant.childId);
});
