// /api/v1/children/[childId]/portals — school credential storage (metadata API).
//
// Contract notes (vs the proposed /credentials with provider cobbk12|microsoft_school):
// • The 003 schema's vocabulary is portal_key ('studentvue' | 'parentvue' |
//   'ctls-learn' | 'o365') — the Vault secret names and the worker's
//   get_tenant_secret() lookups key off it, so the API keeps it. UI mapping:
//     provider 'cobbk12'         → portal_key 'studentvue'
//     provider 'microsoft'       → portal_key 'o365'
//     (ParentVUE lives at portal_key 'parentvue'.)
// • No PATCH: saving is an upsert (rotation resets status to 'unverified').
// • last_used_at ≡ last_verified_at (when the credential last proved good).
//
// GET  — portal metadata for the child. NEVER returns credential values:
//        username is masked, the password is not retrievable by any client
//        path (Vault-backed; see services/portals.ts).
// POST — save (upsert) a credential: { portal_key, label, username?, password }.
//        The password goes straight into set_tenant_secret() and is never
//        logged. The row resets to status='unverified' on every save.
// Parent-only. All writes go through the 003 SECURITY DEFINER RPCs with the
// caller's own JWT (never service_role — see the contract in services/portals.ts).
import { z } from "zod";
import { handleRoute, auditEvent } from "@/server/rest";
import { assertParent } from "@/server/tenant";
import { listPortals, savePortal } from "@/server/services/portals";

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertParent(ctx.params.childId);
  const data = await listPortals(tenant.childId);
  await auditEvent(tenant.childId, "portals.listed");
  return data;
});

const savePortalSchema = z.object({
  portal_key: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  username: z.string().max(320).nullable().optional(),
  password: z.string().min(1).max(500),
});

export const POST = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertParent(ctx.params.childId);
  const body = savePortalSchema.parse(await req.json());
  const data = await savePortal(tenant.childId, body);
  // Audit carries the portal key only — never the credential value.
  await auditEvent(tenant.childId, "portals.saved", { portal_key: body.portal_key });
  return data;
});
