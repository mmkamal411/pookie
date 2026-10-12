// /api/v1/village/kudos — encouragement from the village.
//
// GET ?child_id=… — kudos for a child (tenant + mentor visible).
// POST — a mentor sends kudos.
import { z } from 'zod';
import { handleRoute } from '@/server/rest';
import { listKudos, sendKudos } from '@/server/services/village';

export const GET = handleRoute(async (ctx, req) => {
  const { child_id } = z
    .object({ child_id: z.string().uuid() })
    .parse(Object.fromEntries(new URL(req.url).searchParams.entries()));
  return listKudos(child_id);
});

export const POST = handleRoute(async (ctx, req) => {
  const input = z
    .object({ child_id: z.string().uuid(), message: z.string().min(1).max(500) })
    .parse(await req.json());
  return sendKudos(ctx.userId, input);
});
