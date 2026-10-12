// /api/v1/children/[childId]/school/checkins/[checkinId]/handouts — handout
// uploads DURING the check-in flow (photos/scans of worksheets, study
// guides, notes). Teen-only.
// GET  — list handouts for this check-in (signed URLs).
// POST — multipart: file + class_id → class-handouts bucket +
//        checkin_uploads metadata (auto unit tag from classes.current_unit).
import { handleRoute, auditEvent } from "@/server/rest";
import { ErrorCodes, failWith } from "@/server/errors";
import { assertTenant } from "@/server/tenant";
import {
  listCheckinHandouts,
  uploadCheckinHandout,
} from "@/server/services/school-debrief";

export const GET = handleRoute<{ childId: string; checkinId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const handouts = await listCheckinHandouts(tenant.childId, ctx.params.checkinId);
  await auditEvent(tenant.childId, "school.checkin_handouts.read");
  return { handouts };
});

export const POST = handleRoute<{ childId: string; checkinId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const form = await req.formData();
  const file = form.get("file");
  const classId = form.get("class_id");
  if (!(file instanceof File)) failWith(ErrorCodes.VALIDATION_FAILED);
  if (typeof classId !== "string" || !classId) failWith(ErrorCodes.VALIDATION_FAILED);
  const data = await uploadCheckinHandout(
    tenant.childId,
    ctx.params.checkinId,
    classId,
    ctx.userId,
    file
  );
  await auditEvent(tenant.childId, "school.checkin_handout.uploaded", {
    class_id: classId,
    bytes: file.size,
  });
  return data;
});
