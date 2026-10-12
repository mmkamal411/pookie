// /api/v1/village/mentors — the crew around each child.
//
// GET ?child_id=… — list mentors (tenant parents + the child).
// POST — parent grants a mentor (age-tiered consent applied).
// DELETE ?mentor_id=… — parent revokes instantly.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import {
  grantMentor,
  listMentors,
  revokeMentor,
  grantMentorSchema,
} from '@/server/services/village';

const querySchema = z.object({ child_id: z.string().uuid() });
const deleteSchema = z.object({ mentor_id: z.string().uuid() });

function queryParams(req: Request) {
  return Object.fromEntries(new URL(req.url).searchParams.entries());
}

export const GET = handleRoute(async (ctx, req) => {
  const { child_id } = querySchema.parse(queryParams(req));
  return listMentors(ctx.userId, child_id);
});

export const POST = handleRoute(async (ctx, req) => {
  const input = grantMentorSchema.parse(await req.json());
  const result = await grantMentor(ctx.userId, input);
  await auditEvent(input.child_id, 'village.mentor_granted', {
    relationship: input.relationship,
    status: result.status,
  });
  return result;
});

export const DELETE = handleRoute(async (ctx, req) => {
  const { mentor_id } = deleteSchema.parse(queryParams(req));
  await revokeMentor(ctx.userId, mentor_id);
  return { revoked: true };
});
