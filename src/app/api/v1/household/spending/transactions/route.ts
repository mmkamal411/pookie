// GET /api/v1/household/spending/transactions — visible line items.
// POST — hand-enter a transaction (purchased_by stamps the caller; RLS makes
// mis-attribution impossible).
// Teen privacy: RLS returns zero rows for teen-private purchases the caller
// didn't make — parents see aggregates via /summary, never these line items.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import {
  addManualTransaction,
  listTransactions,
} from '@/server/services/spending';

const listSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: z.string().max(60).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const addSchema = z.object({
  account_ref: z.string().min(1).max(120),
  amount: z.number().finite(),
  merchant: z.string().max(160).optional(),
  category: z.string().max(60).optional(),
  is_teen_private: z.boolean().optional(),
  posted_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  const params = listSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const supabase = await createClient();
  const transactions = await listTransactions(supabase, household.ownerUserId, params);
  await auditEvent(household.anchorChildId, 'spending_transactions.viewed', {
    count: transactions.length,
  });
  return { transactions };
});

export const POST = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  const body = addSchema.parse(await req.json());
  const supabase = await createClient();
  const transaction = await addManualTransaction(supabase, household.ownerUserId, household.userId, body);
  await auditEvent(household.anchorChildId, 'spending_transaction.added', {
    transaction_id: transaction.id,
    source: 'manual',
  });
  return { transaction };
});
