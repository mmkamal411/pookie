// /api/v1/children/[childId]/college/list/[entryId] — one list entry.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { listPatchSchema, patchListEntry, removeListEntry } from "@/server/services/college";

export const PATCH = handleRoute<{ childId: string; entryId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = listPatchSchema.parse(await req.json());
  const supabase = await createClient();
  const entry = await patchListEntry(supabase, ctx.requestId, tenant.childId, ctx.params.entryId, input);
  await auditEvent(tenant.childId, "college.list.updated", { entry_id: ctx.params.entryId });
  return entry;
});

export const DELETE = handleRoute<{ childId: string; entryId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const res = await removeListEntry(supabase, ctx.requestId, tenant.childId, ctx.params.entryId);
  await auditEvent(tenant.childId, "college.list.removed", { entry_id: ctx.params.entryId });
  return res;
});
