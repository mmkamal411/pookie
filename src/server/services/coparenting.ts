// W14 Co-parenting — immutable logistics log, parallel-parenting (FR-MOD-W14, R5).
// Design rules enforced here and in the schema:
//   - Immutable: INSERT-only. No update/delete service functions exist; the
//     table has no UPDATE/DELETE policies or grants. Corrections are new rows
//     with corrects_entry_id.
//   - Parallel-parenting: the API exposes two surfaces — mine (authored by the
//     caller) and theirs (authored by the other parent) — never a shared
//     messaging thread. No reply chains.
//   - Logistics-only at launch: entry_type is schema-constrained to logistics
//     kinds. Free-form messaging is rejected until family-law practitioner
//     review (R5). Children get zero rows (no child-as-courier).
//   - Every entry may carry custody_order_ref + travel_restriction_flags
//     (FR-SAFETY-012) so logistics stay inside the custody order.
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, failWith } from '@/server/errors';

export type CoparentingEntryType =
  | 'pickup' | 'dropoff' | 'expense' | 'schedule' | 'medical_logistics';

export interface CoparentingEntry {
  id: string;
  child_id: string;
  author_id: string;
  entry_type: CoparentingEntryType;
  content: string;
  expense_amount: number | null;
  occurs_at: string | null;
  custody_order_ref: string | null;
  travel_restriction_flags: Record<string, unknown>;
  corrects_entry_id: string | null;
  created_at: string;
}

type Db = Awaited<ReturnType<typeof createClient>>;

const COLS =
  'id, child_id, author_id, entry_type, content, expense_amount, occurs_at, custody_order_ref, travel_restriction_flags, corrects_entry_id, created_at';

function toEntry(row: Record<string, unknown>): CoparentingEntry {
  return {
    id: row.id as string,
    child_id: row.child_id as string,
    author_id: row.author_id as string,
    entry_type: row.entry_type as CoparentingEntryType,
    content: row.content as string,
    expense_amount: row.expense_amount == null ? null : Number(row.expense_amount),
    occurs_at: (row.occurs_at as string) ?? null,
    custody_order_ref: (row.custody_order_ref as string) ?? null,
    travel_restriction_flags: (row.travel_restriction_flags ?? {}) as Record<string, unknown>,
    corrects_entry_id: (row.corrects_entry_id as string) ?? null,
    created_at: row.created_at as string,
  };
}

export interface ParallelParentingLog {
  mine: CoparentingEntry[];
  theirs: CoparentingEntry[];
  launch_mode: 'read-only-logistics';
  review_pending: true;
}

/** Parallel-parenting read: two separate surfaces, no shared thread. */
export async function getParallelLog(
  supabase: Db,
  childId: string,
  userId: string,
): Promise<ParallelParentingLog> {
  const { data, error } = await supabase
    .from('coparenting_log')
    .select(COLS)
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) failWith(ErrorCodes.INTERNAL);
  const entries = ((data ?? []) as Record<string, unknown>[]).map(toEntry);
  return {
    mine: entries.filter((e) => e.author_id === userId),
    theirs: entries.filter((e) => e.author_id !== userId),
    launch_mode: 'read-only-logistics',
    review_pending: true,
  };
}

export interface LogEntryInput {
  entry_type: CoparentingEntryType;
  content: string;
  expense_amount?: number;
  occurs_at?: string;
  custody_order_ref?: string;
  travel_restriction_flags?: Record<string, unknown>;
  corrects_entry_id?: string;
}

/** Append a logistics entry. Immutable — there is no edit or delete path. */
export async function appendLogEntry(
  supabase: Db,
  childId: string,
  userId: string,
  input: LogEntryInput,
): Promise<CoparentingEntry> {
  if (input.entry_type === 'expense' && input.expense_amount == null) {
    failWith(ErrorCodes.VALIDATION_FAILED);
  }
  const { data, error } = await supabase
    .from('coparenting_log')
    .insert({
      child_id: childId,
      author_id: userId,
      entry_type: input.entry_type,
      content: input.content,
      expense_amount: input.expense_amount ?? null,
      occurs_at: input.occurs_at ?? null,
      custody_order_ref: input.custody_order_ref ?? null,
      travel_restriction_flags: (input.travel_restriction_flags ?? {}) as never,
      corrects_entry_id: input.corrects_entry_id ?? null,
    })
    .select(COLS)
    .single();
  if (error || !data) failWith(ErrorCodes.INTERNAL);
  return toEntry(data as Record<string, unknown>);
}
