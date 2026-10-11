// /api/v1/children/[childId]/college/transcript-releases — disclosure accounting.
// The school sends transcripts; we orchestrate. Every release is
// per-college/per-document, explicitly authorized, and audit-logged.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { createRelease, releaseCreateSchema } from "@/server/services/college";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transcript_releases")
    .select("*, colleges:college_id(id,name,city,state,region,control,website)")
    .eq("child_id", tenant.childId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  await auditEvent(tenant.childId, "college.transcript_releases.viewed");
  return (data ?? []).map((r: any) => ({
    id: r.id, child_id: r.child_id, college_id: r.college_id,
    college: r.colleges ?? undefined, document_kind: r.document_kind,
    status: r.status, authorized_text: r.authorized_text ?? null,
    authorized_by: r.authorized_by ?? null, authorized_at: r.authorized_at ?? null,
    sent_at: r.sent_at ?? null,
  }));
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const input = releaseCreateSchema.parse(await req.json());
  const supabase = await createClient();
  const release = await createRelease(supabase, ctx.requestId, tenant.childId, input);
  await auditEvent(tenant.childId, "college.transcript_release.drafted", {
    document_kind: input.document_kind,
    college_id: input.college_id ?? null,
  });
  return release;
});
