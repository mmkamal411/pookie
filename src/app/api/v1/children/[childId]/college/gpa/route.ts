// /api/v1/children/[childId]/college/gpa — the "what does my GPA look like if…"
// simulator. GET returns the current GPA + trend (trend > snapshot). POST
// applies hypothetical per-class overrides WITHOUT writing anything — pure
// read + math via the simulate_gpa() RPC.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { getGpaSimulation, gpaSimulateSchema } from "@/server/services/college";

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const term = new URL(req.url).searchParams.get("term") ?? null;
  const supabase = await createClient();
  const sim = await getGpaSimulation(supabase, tenant.childId, term, []);
  await auditEvent(tenant.childId, "college.gpa.viewed", { term });
  return sim;
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = gpaSimulateSchema.parse(await req.json());
  const supabase = await createClient();
  const sim = await getGpaSimulation(supabase, tenant.childId, input.term ?? null, input.adjustments);
  await auditEvent(tenant.childId, "college.gpa.simulated", {
    term: input.term ?? null,
    adjustments: input.adjustments.length,
  });
  return sim;
});
