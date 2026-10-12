// POST /api/v1/household/spending/csv-import — bank-statement CSV import.
// Body: { csv: string, account_ref: string }. Parses, dedupes by
// (posted_date, merchant, amount), imports as 'csv'-source transactions, and
// auto-categorizes each row with the rule-based categorizer.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { createClient } from '@/lib/supabase/server';
import { parseStatementCsv, importCsvRows } from '@/server/services/spending';

const importSchema = z.object({
  csv: z.string().min(1).max(2_000_000),
  account_ref: z.string().min(1).max(120),
});

export const POST = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  const body = importSchema.parse(await req.json());
  const rows = parseStatementCsv(body.csv);
  const supabase = await createClient();
  const result = await importCsvRows(
    supabase,
    household.ownerUserId,
    household.userId,
    rows,
    body.account_ref,
  );
  await auditEvent(household.anchorChildId, 'spending_csv.imported', {
    parsed: rows.length,
    imported: result.imported,
    skipped: result.skipped,
  });
  return { parsed: rows.length, ...result };
});
