// W24 Credit — minor security-freeze management (O.C.G.A. §§ 10-1-914/914.1).
// GATE: the entire module is gated behind FCRA counsel sign-off. Every row
// defaults to counsel_review_status='pending' and the CHECK constraint
// (credit_freeze_counsel_gate) makes 'requested'+ anything impossible without
// counsel approval. The API exposes a pending-review state until the gate
// flips — this is a legal gate, flipped by counsel, never by a deploy.
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, failWith } from '@/server/errors';

export type Bureau = 'equifax' | 'experian' | 'transunion' | 'innovis' | 'chexsystems';
export type FreezeStatus =
  | 'not_requested' | 'requested' | 'confirmed'
  | 'temporarily_lifted' | 'removed' | 'error';
export type CounselReviewStatus = 'pending' | 'approved' | 'rejected';

export interface CreditFreeze {
  id: string;
  child_id: string;
  bureau: Bureau;
  freeze_status: FreezeStatus;
  requested_by: string | null;
  requested_at: string | null;
  confirmed_at: string | null;
  counsel_review_status: CounselReviewStatus;
  created_at: string;
}

type Db = Awaited<ReturnType<typeof createClient>>;

const COLS =
  'id, child_id, bureau, freeze_status, requested_by, requested_at, confirmed_at, counsel_review_status, created_at';

function toFreeze(row: Record<string, unknown>): CreditFreeze {
  return {
    id: row.id as string,
    child_id: row.child_id as string,
    bureau: row.bureau as Bureau,
    freeze_status: row.freeze_status as FreezeStatus,
    requested_by: (row.requested_by as string) ?? null,
    requested_at: (row.requested_at as string) ?? null,
    confirmed_at: (row.confirmed_at as string) ?? null,
    counsel_review_status: row.counsel_review_status as CounselReviewStatus,
    created_at: row.created_at as string,
  };
}

export interface CreditModuleState {
  gated: true;
  counsel_review_status: CounselReviewStatus;
  freezes: CreditFreeze[];
  guidance: string;
}

/**
 * The module state the UI builds against: always honest about the gate.
 * Freeze actions stay inert until counsel_review_status flips to 'approved'
 * on the relevant rows (flipped by counsel, never by a deploy).
 */
export async function getCreditModuleState(
  supabase: Db,
  childId: string,
): Promise<CreditModuleState> {
  const { data, error } = await supabase
    .from('credit_freezes')
    .select(COLS)
    .eq('child_id', childId)
    .order('bureau', { ascending: true });
  if (error) failWith(ErrorCodes.INTERNAL);
  const freezes = ((data ?? []) as Record<string, unknown>[]).map(toFreeze);
  const overall: CounselReviewStatus = freezes.some((f) => f.counsel_review_status === 'rejected')
    ? 'rejected'
    : freezes.length > 0 && freezes.every((f) => f.counsel_review_status === 'approved')
      ? 'approved'
      : 'pending';
  return {
    gated: true,
    counsel_review_status: overall,
    freezes,
    guidance:
      'Minor security-freeze management is pending FCRA counsel review. No freeze requests can be filed until counsel signs off.',
  };
}

/** Seed the five bureau rows for a child (all 'not_requested' / 'pending'). */
export async function seedFreezeRows(supabase: Db, childId: string, userId: string): Promise<CreditFreeze[]> {
  const bureaus: Bureau[] = ['equifax', 'experian', 'transunion', 'innovis', 'chexsystems'];
  const { data, error } = await supabase
    .from('credit_freezes')
    .upsert(
      bureaus.map((bureau) => ({
        child_id: childId,
        bureau,
        freeze_status: 'not_requested',
        counsel_review_status: 'pending',
        requested_by: userId,
      })),
      { onConflict: 'child_id,bureau', ignoreDuplicates: true },
    )
    .select(COLS);
  if (error) failWith(ErrorCodes.INTERNAL);
  return ((data ?? []) as Record<string, unknown>[]).map(toFreeze);
}
