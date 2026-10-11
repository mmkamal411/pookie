// /api/v1/children/[childId]/college/essays — the essay workspace.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { addEssay, essayCreateSchema } from "@/server/services/college";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("essays")
    .select("*, colleges:college_id(id,name,city,state,region,control,website)")
    .eq("child_id", tenant.childId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  await auditEvent(tenant.childId, "college.essays.viewed");
  return (data ?? []).map((r: any) => ({
    id: r.id, child_id: r.child_id, college_id: r.college_id,
    college: r.colleges ?? undefined, prompt: r.prompt, draft: r.draft ?? null,
    status: r.status, word_limit: r.word_limit ?? null,
  }));
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = essayCreateSchema.parse(await req.json());
  const supabase = await createClient();
  const essay = await addEssay(supabase, ctx.requestId, tenant.childId, input);
  await auditEvent(tenant.childId, "college.essay.added");
  return essay;
});
