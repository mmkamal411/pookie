// DELETE /api/v1/children/[childId]/portals/[portalKey] — remove a credential.
// Parent-only. Deletes the Vault secret AND the metadata row (idempotent —
// returns { removed: false } when nothing matched).
import { handleRoute, auditEvent } from "@/server/rest";
import { assertParent } from "@/server/tenant";
import { removePortal } from "@/server/services/portals";

export const DELETE = handleRoute<{ childId: string; portalKey: string }>(async (ctx) => {
  const tenant = await assertParent(ctx.params.childId);
  const data = await removePortal(tenant.childId, ctx.params.portalKey);
  await auditEvent(tenant.childId, "portals.removed", {
    portal_key: ctx.params.portalKey,
    removed: data.removed,
  });
  return data;
});
