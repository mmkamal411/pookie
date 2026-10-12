// Server-side scope resolution against real data.
// Primary path: the public.resolve_visible_scopes() SQL choke point
// (migration 026). Fallback: compute from child_access + access_scopes via
// the pure mirror in scopes.ts (covers a not-yet-migrated database).
// Total failure degrades to safety_comms-only (fail closed, never open).
import { createClient } from '@/lib/supabase/server';
import { sanitizeScopes, SCOPES, type Scope } from './scopes';

export interface ViewerScopes {
  scopes: Scope[];
  /** True when the viewer IS the teen (their own child_access role='child' row). */
  isTeen: boolean;
}

const COOLING_STATUSES = ['active', 'pending_cooling', 'scheduled_revoke'];

async function isTeenViewer(viewerUserId: string, childId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('child_access')
      .select('role')
      .eq('child_id', childId)
      .eq('user_id', viewerUserId)
      .maybeSingle();
    return (data as { role?: string } | null)?.role === 'child';
  } catch {
    return false;
  }
}

/**
 * resolve_visible_scopes(viewerUserId, childId) — THE choke point.
 * Every /api/v1 response carrying child data filters through this BEFORE
 * serialization (wired into apiHandler). Teen-private scopes (reflection,
 * wellness) are never in a parent's set — proven by unit + SQL tests.
 */
export async function resolveVisibleScopes(
  viewerUserId: string,
  childId: string,
): Promise<ViewerScopes> {
  const supabase = await createClient();

  // Primary: the SQL choke point (SECURITY DEFINER, single source of truth).
  try {
    const { data, error } = await supabase.rpc('resolve_visible_scopes', {
      p_viewer: viewerUserId,
      p_child_id: childId,
    });
    if (!error && Array.isArray(data)) {
      return {
        scopes: sanitizeScopes(data as string[]),
        isTeen: await isTeenViewer(viewerUserId, childId),
      };
    }
  } catch {
    // fall through to the table fallback
  }

  // Fallback: mirror the SQL semantics over the tables directly.
  try {
    const { data: access } = await supabase
      .from('child_access')
      .select('role, status')
      .eq('child_id', childId)
      .eq('user_id', viewerUserId)
      .maybeSingle();
    const row = access as { role?: string; status?: string } | null;
    if (!row) return { scopes: ['safety_comms'], isTeen: false };
    if (row.role === 'child') return { scopes: [...SCOPES], isTeen: true };
    if (!COOLING_STATUSES.includes(row.status ?? '')) {
      return { scopes: ['safety_comms'], isTeen: false };
    }
    const { data: scopeRows } = await supabase
      .from('access_scopes')
      .select('scope')
      .eq('child_id', childId)
      .eq('user_id', viewerUserId)
      .eq('allowed', true);
    const scopes = sanitizeScopes(((scopeRows ?? []) as { scope: string }[]).map((r) => r.scope));
    if (!scopes.includes('safety_comms')) scopes.push('safety_comms');
    return { scopes, isTeen: false };
  } catch {
    // Fail closed: safety channel only.
    return { scopes: ['safety_comms'], isTeen: false };
  }
}

/**
 * Cooling-state frozen view (migration 026): when the viewer's grant is in a
 * cooling state, reads must append `AND created_at <= freeze` so the parent's
 * view stays frozen. Returns null when no freeze applies.
 */
export async function coolingFreezeAt(
  viewerUserId: string,
  childId: string,
): Promise<Date | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('cooling_freeze_at', {
      p_viewer: viewerUserId,
      p_child_id: childId,
    });
    if (error || !data) return null;
    return new Date(data as string);
  } catch {
    return null;
  }
}
