// PATCH /api/v1/household/shopping/preferences — standing rules live here.
// Parent-only. Preferences MERGE server-side (never replaced).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHouseholdParent } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { resolveHouseholdList, updatePreferences } from '@/server/services/shopping';

const preferencesSchema = z.object({
  preferences: z.record(z.string(), z.unknown()),
});

export const PATCH = handleRoute(async (ctx, req) => {
  const household = await assertHouseholdParent();
  const body = preferencesSchema.parse(await req.json());
  const supabase = await createClient();
  const list = await resolveHouseholdList(supabase, household);
  const preferences = await updatePreferences(supabase, list.id, body.preferences);
  await auditEvent(household.anchorChildId, 'shopping_prefs.updated', {
    keys: Object.keys(body.preferences),
  });
  return { preferences };
});
