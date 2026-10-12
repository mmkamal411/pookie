// /api/v1/children/[childId]/school/checkin-settings
// FR-SCHOOL-003: per-teen check-in retention setting (rolling_90d default).
// TEEN-OWNED — the teen reads/changes it; parents have read-only visibility
// via teen_privacy_settings RLS (labeled state on the Sharing screen).
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import {
  getRetentionSetting,
  retentionSchema,
  setRetentionSetting,
} from "@/server/services/calibration";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  return getRetentionSetting(tenant.childId);
});

export const PATCH = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const body = retentionSchema.parse(await req.json());
  const data = await setRetentionSetting(tenant.childId, body);
  await auditEvent(tenant.childId, "checkin.retention_changed", {
    checkin_retention: body.checkin_retention,
  });
  return data;
});
