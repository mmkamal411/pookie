// GET /api/v1/children — all children in the caller's tenant set.
// Drives the child switcher. RLS scopes rows via current_child_ids();
// the route asserts an authenticated session via the wrapper.
// Read-only list: no per-child audit (audit_event requires a single child_id).
//
// POST /api/v1/children — add a child (name, school, grade).
// Parent-only. Goes through the create_child() RPC (child row + parent
// access row atomically). The caller's FIRST child comes from the invite
// path instead — the RPC raises parent_membership_required otherwise.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { listMyChildren, createChild } from '@/server/services/children';

export const GET = handleRoute(async () => listMyChildren());

const createChildSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  nickname: z.string().max(80).nullable().optional(),
  slug: z.string().max(80).nullable().optional(),
  schoolName: z.string().max(200).nullable().optional(),
  gradeLevel: z.string().max(20).nullable().optional(),
  timezone: z.string().max(60).nullable().optional(),
});

export const POST = handleRoute(async (ctx, req) => {
  const body = createChildSchema.parse(await req.json());
  const { id } = await createChild(body);
  await auditEvent(id, 'child.created');
  return { id };
});
