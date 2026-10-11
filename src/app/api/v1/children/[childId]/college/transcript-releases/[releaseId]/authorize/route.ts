// POST /api/v1/children/[childId]/college/transcript-releases/[releaseId]/authorize
// EXPLICIT authorization: the signer approves the exact authorized_text, which
// is frozen on the row (release_authorization_integrity CHECK). Authority:
// parent for minors; the student themself at 18+ (release_authority_for,
// lazy DOB check — unknown DOB fails closed to parent). Every authorization
// is audit-logged (disclosure accounting).
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { authorizeRelease, releaseAuthorizeSchema } from "@/server/services/college";

export const POST = handleRoute<{ childId: string; releaseId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = releaseAuthorizeSchema.parse(await req.json());
  const supabase = await createClient();
  const { release, authority } = await authorizeRelease(
    supabase, ctx.requestId, tenant.childId, tenant.userId, tenant.role,
    ctx.params.releaseId, input,
  );
  await auditEvent(tenant.childId, "college.transcript_release.authorized", {
    release_id: ctx.params.releaseId,
    authority,
    authorized_text: input.authorized_text,
  });
  return release;
});
