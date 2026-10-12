// GET /api/v1/children/[childId]/coparenting/log — parallel-parenting read.
// POST — append a logistics entry.
// Parallel-parenting: two separate surfaces (mine / theirs), never a shared
// messaging thread. The log is immutable — there is no edit or delete path;
// corrections are new rows. Launch is logistics-only pending family-law
// practitioner review (R5); free-form messaging is schema-blocked.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertParent } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { appendLogEntry, getParallelLog } from '@/server/services/coparenting';

type Params = { childId: string };

const appendSchema = z.object({
  entry_type: z.enum(['pickup', 'dropoff', 'expense', 'schedule', 'medical_logistics']),
  content: z.string().min(1).max(2000),
  expense_amount: z.number().positive().max(1_000_000).optional(),
  occurs_at: z.string().datetime().optional(),
  custody_order_ref: z.string().max(200).optional(),
  travel_restriction_flags: z.record(z.string(), z.unknown()).optional(),
  corrects_entry_id: z.string().uuid().optional(),
});

export const GET = handleRoute<Params>(async (ctx) => {
  const tenant = await assertParent(ctx.params.childId);
  const supabase = await createClient();
  const log = await getParallelLog(supabase, tenant.childId, tenant.userId);
  await auditEvent(tenant.childId, 'coparenting_log.viewed', {
    mine: log.mine.length,
    theirs: log.theirs.length,
  });
  return log;
});

export const POST = handleRoute<Params>(async (ctx, req) => {
  const tenant = await assertParent(ctx.params.childId);
  const body = appendSchema.parse(await req.json());
  const supabase = await createClient();
  const entry = await appendLogEntry(supabase, tenant.childId, tenant.userId, body);
  await auditEvent(tenant.childId, 'coparenting_log.appended', {
    entry_id: entry.id,
    entry_type: entry.entry_type,
  });
  return { entry };
});
