// /api/v1/children/[childId]/school/resource-library — per-class resource library.
// GET  ?class_id= — list (seeds recommendations on first view).
// POST — add a resource { class_id, title, url?, resource_type, description?, unit_tag? }.
// Any tenant member may curate; RLS (owner-or-parent) gates writes.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import {
  classSlugFor,
  createLibraryResource,
  listLibraryResources,
  resourceUpsertSchema,
} from "@/server/services/school-resources";

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const classId = req.nextUrl.searchParams.get("class_id") ?? "";
  if (!classId) {
    return { resources: [], seeded: false };
  }
  const slug = await classSlugFor(tenant.childId, classId);
  const data = await listLibraryResources(tenant.childId, classId, slug);
  await auditEvent(tenant.childId, "school.resource_library.read", { class_id: classId });
  return data;
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const body = resourceUpsertSchema.parse(await req.json());
  const data = await createLibraryResource(tenant.childId, body);
  await auditEvent(tenant.childId, "school.resource_library.add", { class_id: body.class_id });
  return data;
});
