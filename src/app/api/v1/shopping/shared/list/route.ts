// /api/v1/shopping/shared/list — shared-list views and item ops for recipients.
//
// GET ?list_id=… — full view of a list shared with the caller.
// POST (body: list_id, name, quantity?, unit?, note?) — add an item.
// PATCH /api/v1/shopping/shared/list/items/[itemId] — transition (claim/buy).
import { z } from 'zod';
import { handleRoute } from '@/server/rest';
import {
  getSharedListView,
  addSharedItem,
  transitionSharedItem,
} from '@/server/services/shopping-shares';

const addSchema = z.object({
  list_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  quantity: z.coerce.number().positive().max(9999).default(1),
  unit: z.string().max(20).optional(),
  note: z.string().max(300).optional(),
});

export const GET = handleRoute(async (ctx, req) => {
  const { list_id } = z
    .object({ list_id: z.string().uuid() })
    .parse(Object.fromEntries(new URL(req.url).searchParams.entries()));
  return getSharedListView(ctx.userId, list_id);
});

export const POST = handleRoute(async (ctx, req) => {
  const input = addSchema.parse(await req.json());
  return addSharedItem(ctx.userId, input.list_id, input);
});
