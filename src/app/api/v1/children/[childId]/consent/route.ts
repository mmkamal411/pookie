// GET/POST/DELETE /api/v1/children/[childId]/consent — verifiable parental
// consent for under-13 child login (076, Squad Cradle).
//
// GET — current consent state (tenant parents + the child).
// POST { method, detail? } — parent records consent (opens the invite gate).
// DELETE — parent revokes consent (closes the gate for future consumes).
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant, assertParent } from "@/server/tenant";
import {
  grantConsent,
  revokeConsent,
  getConsent,
  grantConsentSchema,
} from "@/server/services/parental-consent";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  return getConsent(tenant.childId);
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertParent(ctx.params.childId);
  const input = grantConsentSchema.parse(await req.json());
  const result = await grantConsent(ctx.userId, tenant.childId, input);
  await auditEvent(tenant.childId, "consent.parental_granted_api", {
    method: input.method,
  });
  return result;
});

export const DELETE = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertParent(ctx.params.childId);
  const result = await revokeConsent(ctx.userId, tenant.childId);
  await auditEvent(tenant.childId, "consent.parental_revoked_api", {});
  return result;
});
