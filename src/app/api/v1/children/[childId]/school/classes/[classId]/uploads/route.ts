// /api/v1/children/[childId]/school/classes/[classId]/uploads — class handout files.
// GET  — list files in the class folder (15-minute signed URLs, view-only).
// POST — upload a file (multipart, ≤10MB) via service_role into
//        <uid>/<child-slug>/<class-slug>/<yyyy-mm-dd>/<file> (class-files bucket).
// service_role lives in the service layer (server-only) — never client code.
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { ErrorCodes, failWith } from "@/server/errors";
import { assertTenant } from "@/server/tenant";
import { listClassFiles, uploadClassFile } from "@/server/services/school";

const paramsSchema = z.object({
  childId: z.string().uuid(),
  classId: z.string().uuid(),
});

export const GET = handleRoute<{ childId: string; classId: string }>(async (ctx) => {
  const { childId, classId } = paramsSchema.parse(ctx.params);
  const tenant = await assertTenant(childId);
  return listClassFiles(tenant.childId, classId);
});

export const POST = handleRoute<{ childId: string; classId: string }>(async (ctx, req) => {
  const { childId, classId } = paramsSchema.parse(ctx.params);
  const tenant = await assertTenant(childId);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) failWith(ErrorCodes.VALIDATION_FAILED);
  const data = await uploadClassFile(tenant.childId, classId, ctx.userId, file);
  await auditEvent(tenant.childId, "class_file.uploaded", {
    class_id: classId,
    bytes: file.size,
  });
  return data;
});
