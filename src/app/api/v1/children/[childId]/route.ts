// GET /api/v1/children/[childId] — one child by id.
// resolve → assert → use → audit. The [childId] param is a hint the route
// validates: assertTenant rejects anything outside the caller's tenant set
// with 403 (never 404 — do not confirm/deny tenant existence).
import { handleRoute, auditEvent } from '@/server/rest';
import { assertTenant } from '@/server/tenant';
import { getChild } from '@/server/services/children';
import { ErrorCodes, failWith } from '@/server/errors';

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const child = await getChild(tenant.childId);
  if (!child) failWith(ErrorCodes.NOT_FOUND);
  await auditEvent(tenant.childId, 'child_viewed');
  return child;
});
