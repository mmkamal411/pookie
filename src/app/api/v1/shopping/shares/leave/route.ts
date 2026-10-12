// POST /api/v1/shopping/shares/leave — a recipient leaves a shared list.
import { z } from 'zod';
import { handleRoute } from '@/server/rest';
import { leaveSharedList } from '@/server/services/shopping-shares';

export const POST = handleRoute(async (ctx, req) => {
  const { list_id } = z
    .object({ list_id: z.string().uuid() })
    .parse(await req.json());
  await leaveSharedList(ctx.userId, list_id);
  return { left: true };
});
