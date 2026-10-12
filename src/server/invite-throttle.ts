// SEC-002 (2026-10-12): per-user throttle + failure audit for
// POST /api/v1/invites/consume.
//
// Ledger: public.invite_consume_attempts (migration 050). All helpers are
// best-effort: if the table or the log_access_event RPC is not yet migrated,
// the throttle is skipped — but the enumeration-oracle collapse in
// mapDbError (single INVITE_NOT_FOUND code/message) holds regardless.
import type { SupabaseClient } from '@supabase/supabase-js';
import { ErrorCodes, failWith } from './errors';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/** Throw RATE_LIMITED when the user exhausted the consume window. */
export async function checkInviteConsumeThrottle(
  db: SupabaseClient,
  userId: string,
): Promise<void> {
  let count: number | null = null;
  try {
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const res = await db
      .from('invite_consume_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('attempted_at', since);
    if (!res.error) count = res.count ?? 0;
  } catch {
    count = null;
  }
  if (count !== null && count >= MAX_ATTEMPTS) {
    failWith(ErrorCodes.RATE_LIMITED);
  }
}

/** Record one consume attempt (success or failure). Never throws. */
export async function recordInviteConsumeAttempt(
  db: SupabaseClient,
  userId: string,
  success: boolean,
): Promise<void> {
  try {
    await db.from('invite_consume_attempts').insert({ user_id: userId, success });
  } catch {
    // best-effort: a missing table must not break the consume path
  }
}

/** Audit a failed consume to access_events (invite_consume_failed). Never throws. */
export async function auditInviteConsumeFailure(
  db: SupabaseClient,
  userId: string,
): Promise<void> {
  try {
    await db.rpc('log_access_event', {
      p_child_id: null,
      p_actor_user_id: userId,
      p_event_type: 'invite_consume_failed',
      p_metadata: {},
    });
  } catch {
    // best-effort
  }
}
