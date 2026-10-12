// GET /api/v1/shopping/shares — lists the caller's shares out + shares in.
// POST /api/v1/shopping/shares — share the caller's household list by email.
// DELETE /api/v1/shopping/shares?share_id=… — owner revokes a share.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import {
  listMyShares,
  shareListWith,
  revokeShare,
  shareListSchema,
} from '@/server/services/shopping-shares';

export const GET = handleRoute(async (ctx) => {
  return listMyShares(ctx.userId);
});

export const POST = handleRoute(async (ctx, req) => {
  const { email } = shareListSchema.parse(await req.json());
  const result = await shareListWith(ctx.userId, email);
  const household = await assertHousehold().catch(() => null);
  if (household) {
    await auditEvent(household.anchorChildId, 'shopping_list.shared', { email });
  }
  return result;
});

export const DELETE = handleRoute(async (ctx, req) => {
  const { share_id } = z
    .object({ share_id: z.string().uuid() })
    .parse(Object.fromEntries(new URL(req.url).searchParams.entries()));
  await revokeShare(ctx.userId, share_id);
  return { revoked: true };
});
