// POST /api/v1/children/[childId]/college/test-scores/[scoreId]/report
// Score-report upload (multipart form-data, field "file"). Stored in the
// private 'test-score-reports' bucket at <child_id>/scores/<yyyy-mm-dd>/<file>.
// Uploaded via the service_role admin client (server-only); the storage RLS
// policies are defense-in-depth. 8 MB cap, PDF/image only.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ErrorCodes, failWith } from "@/server/errors";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/png", "image/jpeg"];

// Always dynamic: this upload route can never be static
// (auth cookies + multipart POST).
export const dynamic = "force-dynamic";

export const POST = handleRoute<{ childId: string; scoreId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) failWith(ErrorCodes.VALIDATION_FAILED);
  if (!ALLOWED.includes(file.type)) failWith(ErrorCodes.VALIDATION_FAILED);
  if (file.size > MAX_BYTES) failWith(ErrorCodes.VALIDATION_FAILED);

  const supabase = await createClient();
  const { data: row, error: rowErr } = await supabase
    .from("test_scores").select("id").eq("id", ctx.params.scoreId).eq("child_id", tenant.childId).single();
  if (rowErr || !row) failWith(ErrorCodes.NOT_FOUND);

  const day = new Date().toISOString().slice(0, 10);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `${tenant.childId}/scores/${day}/${ctx.params.scoreId}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabaseAdmin.storage
    .from("test-score-reports")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) failWith(ErrorCodes.INTERNAL);

  // A new report invalidates any prior human verification.
  const { error: updErr } = await supabase
    .from("test_scores").update({ report_path: path, verified: false })
    .eq("id", ctx.params.scoreId).eq("child_id", tenant.childId);
  if (updErr) failWith(ErrorCodes.INTERNAL);

  await auditEvent(tenant.childId, "college.test_score.report_uploaded", { score_id: ctx.params.scoreId });
  return { report_path: path };
});
