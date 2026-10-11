// GET /api/v1/me — the caller's profile (public.users row).
// PATCH /api/v1/me — update display name. Only display_name is writable
// (column GRANT + RLS enforce this; email/role are never client-settable).
//
// resolve → assert → use → audit. assertHousehold anchors audit + prefs to
// the caller's default/own child; the profile itself is user-scoped.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { getProfile, updateProfile } from '@/server/services/profile';
import { ErrorCodes, failWith } from '@/server/errors';

export const GET = handleRoute(async () => {
  const household = await assertHousehold();
  const profile = await getProfile(household.userId);
  if (!profile) failWith(ErrorCodes.NOT_FOUND);
  await auditEvent(household.anchorChildId, 'profile.viewed');
  return profile;
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80).nullable().optional(),
});

export const PATCH = handleRoute(async (_ctx, req) => {
  const household = await assertHousehold();
  const body = updateProfileSchema.parse(await req.json());
  const profile = await updateProfile(household.userId, { name: body.name });
  if (!profile) failWith(ErrorCodes.NOT_FOUND);
  await auditEvent(household.anchorChildId, 'profile.updated');
  return profile;
});
