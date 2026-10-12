// W15 Screen Time co-set — shared backend logic for the three API routes
// (/api/v1/safety/screen-time, /review, /appeal).
//
// Device-limit agreements only: no diagnoses, no health data. The row shape
// matches the ScreenTimeState / ScreenTimePlan contract in
// src/components/safety/types.ts exactly; the state machine is:
//
//   draft →(teen proposes)→ proposed →(parent approve)→ active
//                                     →(parent counter)→ change_requested →(teen proposes)→ proposed
//                                     →(parent decline)→ draft
//   active →(teen or parent proposes a change)→ proposed
//   active →(teen appeals)→ appeal open →(parent approve)→ change_requested
//                                            →(parent deny)→ active (appeal closed)
//
// One open appeal slot per plan (appeal_* columns); a new proposal or review
// decision supersedes it.
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type {
  ScreenTimeAppeal,
  ScreenTimePlan,
  ScreenTimeState,
} from '@/components/safety/types';

type Db = Awaited<ReturnType<typeof createClient>>;

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM');

/** ScreenTimePlan contract (must match src/components/safety/types.ts). */
export const screenTimePlanSchema = z.object({
  bedtimeWindDown: hhmm,
  budgets: z
    .array(
      z.object({
        category: z.string().trim().min(1).max(60),
        minutes: z.number().int().min(0).max(480),
      }),
    )
    .max(20),
  focusBlocks: z
    .array(
      z.object({
        days: z.string().trim().min(1).max(40),
        start: hhmm,
        end: hhmm,
      }),
    )
    .max(10),
});

export const emptyScreenTimePlan: ScreenTimePlan = {
  bedtimeWindDown: '',
  budgets: [],
  focusBlocks: [],
};

export interface ScreenTimeRow {
  id: string;
  child_profile_id: string;
  owner_user_id: string;
  status: 'draft' | 'proposed' | 'active' | 'change_requested';
  plan: unknown;
  proposed_by: 'teen' | 'parent' | null;
  last_change_by: 'teen' | 'parent' | null;
  last_change_at: string | null;
  appeal_reason: string | null;
  appeal_at: string | null;
  appeal_response: string | null;
  appeal_responded_at: string | null;
}

function asPlan(raw: unknown): ScreenTimePlan {
  const parsed = screenTimePlanSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Stored plan predates/violates the schema — never crash the GET.
  return emptyScreenTimePlan;
}

/** The household owner anchor for a child (the parent the plan belongs to). */
export async function resolveScreenTimeOwner(
  db: Db,
  childId: string,
): Promise<string | null> {
  const { data, error } = await db.rpc('household_owner_for_child', {
    p_child_id: childId,
  });
  if (error || !data) return null;
  return data as string;
}

export async function getScreenTimeRow(
  db: Db,
  childId: string,
): Promise<ScreenTimeRow | null> {
  const { data, error } = await db
    .from('screen_time_plans')
    .select('*')
    .eq('child_profile_id', childId)
    .maybeSingle();
  if (error) return null;
  return data as ScreenTimeRow | null;
}

/**
 * Build the full ScreenTimeState for a child. No row yet → draft with an
 * empty plan. Names resolve from children (teen) and users (owner parent).
 */
export async function getScreenTimeState(
  db: Db,
  childId: string,
): Promise<ScreenTimeState> {
  const row = await getScreenTimeRow(db, childId);

  const { data: child } = await db
    .from('children')
    .select('first_name, nickname')
    .eq('id', childId)
    .maybeSingle();
  const c = child as { first_name?: string; nickname?: string | null } | null;
  const teenName = c?.nickname || c?.first_name || 'Your teen';

  const ownerId =
    row?.owner_user_id ?? (await resolveScreenTimeOwner(db, childId));
  let parentName = 'Parent';
  if (ownerId) {
    const { data: owner } = await db
      .from('users')
      .select('display_name')
      .eq('id', ownerId)
      .maybeSingle();
    const name = (owner as { display_name?: string | null } | null)
      ?.display_name;
    if (name) parentName = name;
  }

  return {
    status: row?.status ?? 'draft',
    plan: row ? asPlan(row.plan) : emptyScreenTimePlan,
    teenName,
    parentName,
    lastChangeAt: row?.last_change_at ?? null,
    lastChangeBy: row?.last_change_by ?? null,
    proposedBy: row?.proposed_by ?? null,
    appealReason: row?.appeal_reason ?? null,
    appealAt: row?.appeal_at ?? null,
    appealResponse: row?.appeal_response ?? null,
    appealRespondedAt: row?.appeal_responded_at ?? null,
  };
}

/** Current open appeal as a list (the UI's listScreenTimeAppeals contract). */
export function currentAppealAsList(row: ScreenTimeRow | null): ScreenTimeAppeal[] {
  if (!row || !row.appeal_reason) return [];
  return [
    {
      id: row.id,
      reason: row.appeal_reason,
      createdAt: row.appeal_at ?? '',
      response: row.appeal_response,
      respondedAt: row.appeal_responded_at,
    },
  ];
}
