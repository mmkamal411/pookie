// PATCH / DELETE one library resource. Owner-or-parent RLS gates the write.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import {
  deleteLibraryResource,
  resourceUpsertSchema,
  updateLibraryResource,
} from "@/server/services/school-resources";

const patchSchema = resourceUpsertSchema.partial().omit({ class_id: true });

export const PATCH = handleRoute<{ childId: string; resourceId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const data = await updateLibraryResource(
    tenant.childId,
    ctx.params.resourceId,
    patchSchema.parse(await req.json())
  );
  await auditEvent(tenant.childId, "school.resource_library.update");
  return data;
});

export const DELETE = handleRoute<{ childId: string; resourceId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  await deleteLibraryResource(tenant.childId, ctx.params.resourceId);
  await auditEvent(tenant.childId, "school.resource_library.remove");
  return { removed: true };
});
