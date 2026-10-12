// GET /api/v1/household/babysitters — the parent-vetted directory.
// POST — add a sitter. Every row carries the data-model disclaimer:
// "parent-vetted, not background-checked by Pookie".
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { addSitter, listSitters } from '@/server/services/babysitters';

const addSchema = z.object({
  name: z.string().min(1).max(120),
  contact: z.string().max(160).optional(),
  notes: z.string().max(1000).optional(),
});

export const GET = handleRoute(async () => {
  const household = await assertHousehold();
  const supabase = await createClient();
  const sitters = await listSitters(supabase, household.ownerUserId);
  await auditEvent(household.anchorChildId, 'babysitters.viewed', {
    count: sitters.length,
  });
  return { sitters };
});

export const POST = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  const body = addSchema.parse(await req.json());
  const supabase = await createClient();
  const sitter = await addSitter(supabase, household.ownerUserId, household.userId, body);
  await auditEvent(household.anchorChildId, 'babysitter.added', {
    sitter_id: sitter.id,
  });
  return { sitter };
});
