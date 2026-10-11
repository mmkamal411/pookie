// GET /api/v1/me/notifications — notification preferences.
// PATCH /api/v1/me/notifications — merge-patch preferences.
//
// Prefs are stored in child_settings.notifications for the caller's anchor
// child (default child for parents, own child for teens) until the SQL
// workstream ships a user-level notification_prefs table. Reads merge over
// defaults so the shape is always complete.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from '@/server/services/profile';

export const GET = handleRoute(async () => {
  const household = await assertHousehold();
  const prefs = await getNotificationPrefs(household.anchorChildId);
  await auditEvent(household.anchorChildId, 'notification_prefs.viewed');
  return prefs;
});

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM')
  .nullable();

const updatePrefsSchema = z.object({
  sync_complete: z.boolean().optional(),
  grade_drop: z.boolean().optional(),
  due_soon: z.boolean().optional(),
  weekly_digest: z.boolean().optional(),
  quiet_hours_start: timeSchema.optional(),
  quiet_hours_end: timeSchema.optional(),
});

export const PATCH = handleRoute(async (_ctx, req) => {
  const household = await assertHousehold();
  const body = updatePrefsSchema.parse(await req.json());
  const prefs = await updateNotificationPrefs(household.anchorChildId, body);
  await auditEvent(household.anchorChildId, 'notification_prefs.updated');
  return prefs;
});
