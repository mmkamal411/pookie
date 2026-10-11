// /api/v1/children/[childId]/college/list — the child's college list.
// resolve → assertTenant → use → audit.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { addToList, listCreateSchema } from "@/server/services/college";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("college_list")
    .select("*, colleges:college_id(id,name,city,state,region,control,website)")
    .eq("child_id", tenant.childId)
    .order("created_at");
  if (error) throw error;
  await auditEvent(tenant.childId, "college.list.viewed");
  return (data ?? []).map((r: any) => ({
    id: r.id, child_id: r.child_id, college_id: r.college_id,
    college: r.colleges ?? undefined, status: r.status, notes: r.notes ?? null,
  }));
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = listCreateSchema.parse(await req.json());
  const supabase = await createClient();
  const entry = await addToList(supabase, ctx.requestId, tenant.childId, input);
  await auditEvent(tenant.childId, "college.list.added", { college_id: input.college_id });
  return entry;
});
