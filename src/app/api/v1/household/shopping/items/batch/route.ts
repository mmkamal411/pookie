// POST /api/v1/household/shopping/items/batch — bulk add for the W13 seam:
// meal plans drop grocery lists here, tagged with source + source_ref.
// Parent role required when source='meal-plan' (parent-approved plans);
// the service_role worker variant (future) asserts explicit owner scope
// instead of assertHousehold.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, failWith } from '@/server/errors';
import { resolveHouseholdList, addItemsBatch } from '@/server/services/shopping';

const batchSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        quantity: z.coerce.number().positive().max(9999).default(1),
        unit: z.string().max(20).optional(),
        note: z.string().max(300).optional(),
      }),
    )
    .min(1)
    .max(50),
  source: z.enum(['meal-plan', 'recurring', 'ai-suggestion']),
  source_ref: z.record(z.string(), z.unknown()).optional(),
  list_id: z.string().uuid().optional(),
});

export const POST = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  const body = batchSchema.parse(await req.json());
  if (body.source === 'meal-plan' && household.role !== 'parent') {
    failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  }
  const supabase = await createClient();
  const list = await resolveHouseholdList(supabase, household, body.list_id);
  const result = await addItemsBatch(
    supabase,
    list.id,
    household.userId,
    body.items,
    body.source,
    body.source_ref,
  );
  await auditEvent(household.anchorChildId, 'shopping_items.batch_added', {
    source: body.source,
    count: result.items.length,
    merged: result.merged,
  });
  return result;
});
