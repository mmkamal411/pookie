// POST /api/v1/children/[childId]/college/transcript-releases/[releaseId]/mark-sent
// Records that the authorized release was actually sent (by the school or the
// family). Only an approved release can be marked sent — the DB CHECK plus
// this route's status gate keep the state machine honest.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertParent } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { markReleaseSent } from "@/server/services/college";

export const POST = handleRoute<{ childId: string; releaseId: string }>(async (ctx) => {
  const tenant = await assertParent(ctx.params.childId);
  const supabase = await createClient();
  const release = await markReleaseSent(supabase, ctx.requestId, tenant.childId, ctx.params.releaseId);
  await auditEvent(tenant.childId, "college.transcript_release.sent", { release_id: ctx.params.releaseId });
  return release;
});
