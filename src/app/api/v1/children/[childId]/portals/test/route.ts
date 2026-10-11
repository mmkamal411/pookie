// POST /api/v1/children/[childId]/portals/test — "Test connection", dual mode.
// Parent-only.
//
//   { portal_key }                        → tests the SAVED credential
//                                           (scope 'vault_material').
//   { portal_key, username?, password }    → validate-BEFORE-save: sanity
//                                           checks only, nothing is persisted
//                                           (scope 'pre_save').
//
// Neither mode performs a live school-portal login — the live check is the
// verify-credential Edge Function (future). The response's `scope` + `message`
// tell the UI exactly what was proven; the UI must not label a `true` here
// as "portal login verified".
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertParent } from "@/server/tenant";
import { testPortal } from "@/server/services/portals";

const testSchema = z.object({
  portal_key: z.string().min(1).max(60),
  username: z.string().max(320).nullable().optional(),
  // Write-only: used for sanity checks, never persisted, never logged.
  password: z.string().max(500).nullable().optional(),
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertParent(ctx.params.childId);
  const body = testSchema.parse(await req.json());
  const data = await testPortal(tenant.childId, body);
  // Audit carries the portal key + scope only — never credential values.
  await auditEvent(tenant.childId, "portals.tested", {
    portal_key: body.portal_key,
    scope: data.scope,
    ok: data.ok,
  });
  return data;
});
