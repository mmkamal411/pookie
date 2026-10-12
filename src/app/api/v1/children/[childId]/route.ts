// GET /api/v1/children/[childId] — one child by id.
// resolve → assert → use → audit. The [childId] param is a hint the route
// validates: assertTenant rejects anything outside the caller's tenant set
// with 403 (never 404 — do not confirm/deny tenant existence).
//
// PATCH /api/v1/children/[childId] — edit child fields (name, school, grade…).
// Parent: full field set. Child role: nickname ONLY (self-service, own record).
// slug/status excluded by design (see services/children.ts).
//
// DELETE /api/v1/children/[childId] — remove a child = SOFT DELETE
// (status -> 'archived'). Parent-only. History (grades, assignments,
// messages) is preserved and the archive is reversible.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertTenant, assertParent } from '@/server/tenant';
import { getChild, updateChild, archiveChild } from '@/server/services/children';
import { ErrorCodes, failWith } from '@/server/errors';

export const GET = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertTenant(ctx.params.childId);
  const child = await getChild(tenant.childId);
  if (!child) failWith(ErrorCodes.NOT_FOUND);
  await auditEvent(tenant.childId, 'child_viewed');
  return child;
});

const updateChildSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  nickname: z.string().max(80).nullable().optional(),
  schoolName: z.string().max(200).nullable().optional(),
  district: z.string().max(200).nullable().optional(),
  gradeLevel: z.string().max(20).nullable().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  studentId: z.string().max(40).nullable().optional(),
  timezone: z.string().max(60).nullable().optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
});

/** Child self-service schema: nickname ONLY. Every other field stays parent-only. */
const childSelfServiceSchema = z.object({
  nickname: z.string().max(80).nullable(),
});

export const PATCH = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const body = await req.json();
  if (tenant.role === 'parent') {
    const parsed = updateChildSchema.parse(body);
    const child = await updateChild(tenant.childId, parsed);
    if (!child) failWith(ErrorCodes.NOT_FOUND);
    await auditEvent(tenant.childId, 'child.updated');
    return child;
  }
  // Child self-service (Squad Harbor 2026-10-12): a child-role session may
  // update ONLY its own nickname. assertTenant already scopes childId to the
  // caller's own tenant record(s); the restricted schema keeps every other
  // field parent-only. UI hiding is not the enforcement — this branch is.
  const parsed = childSelfServiceSchema.parse(body);
  const child = await updateChild(tenant.childId, { nickname: parsed.nickname });
  if (!child) failWith(ErrorCodes.NOT_FOUND);
  await auditEvent(tenant.childId, 'child.nickname_updated');
  return child;
});

export const DELETE = handleRoute<{ childId: string }>(async (ctx) => {
  const tenant = await assertParent(ctx.params.childId);
  const result = await archiveChild(tenant.childId);
  await auditEvent(tenant.childId, 'child.archived');
  return result;
});
