// /api/v1/children/[childId]/college/deadlines — deadline tracking.
// Reminder buckets (30/14/7/2 days) are derived at read time, never stored.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { addDeadline, deadlineCreateSchema } from "@/server/services/college";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deadlines")
    .select("*, colleges:college_id(id,name,city,state,region,control,website)")
    .eq("child_id", tenant.childId)
    .order("due_at");
  if (error) throw error;
  await auditEvent(tenant.childId, "college.deadlines.viewed");
  return (data ?? []).map((r: any) => ({
    id: r.id, child_id: r.child_id, college_id: r.college_id,
    college: r.colleges ?? undefined, kind: r.kind, label: r.label,
    due_at: r.due_at, notes: r.notes ?? null, done: r.done,
  }));
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = deadlineCreateSchema.parse(await req.json());
  const supabase = await createClient();
  const deadline = await addDeadline(supabase, ctx.requestId, tenant.childId, input);
  await auditEvent(tenant.childId, "college.deadline.added", { label: input.label });
  return deadline;
});
