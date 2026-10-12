// PATCH /api/v1/shopping/shared/list/items/[itemId] — claim / buy / unclaim.
import { z } from 'zod';
import { handleRoute } from '@/server/rest';
import { transitionSharedItem } from '@/server/services/shopping-shares';

const bodySchema = z.object({
  list_id: z.string().uuid(),
  status: z.enum(['needed', 'claimed', 'bought']),
});

export const PATCH = handleRoute<{ itemId: string }>(async (ctx, req) => {
  const body = bodySchema.parse(await req.json());
  return transitionSharedItem(ctx.userId, body.list_id, ctx.params.itemId, body.status);
});
