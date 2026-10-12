// GET /api/v1/household/babysitters/[sitterId] — one sitter.
// PATCH — update contact/notes (tier and block status change only via the
// grant-outcome RPC — the directory never hand-edits trust).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { getSitter, updateSitter } from '@/server/services/babysitters';

type Params = { sitterId: string };

const patchSchema = z.object({
  contact: z.string().max(160).optional(),
  notes: z.string().max(1000).optional(),
});

export const GET = handleRoute<Params>(async (ctx) => {
  const household = await assertHousehold();
  const supabase = await createClient();
  const sitter = await getSitter(supabase, household.ownerUserId, ctx.params.sitterId);
  return { sitter };
});

export const PATCH = handleRoute<Params>(async (ctx, req) => {
  const household = await assertHousehold();
  const body = patchSchema.parse(await req.json());
  const supabase = await createClient();
  const sitter = await updateSitter(supabase, household.ownerUserId, ctx.params.sitterId, body);
  await auditEvent(household.anchorChildId, 'babysitter.updated', {
    sitter_id: sitter.id,
  });
  return { sitter };
});
