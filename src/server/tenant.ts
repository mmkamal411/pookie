// Tenant resolution + assertion. The pattern for EVERY backend entry point:
//   1. RESOLVE — obtain child_id (slug→id, body field, job payload).
//   2. ASSERT  — child_id = ANY(current_child_ids()) for the caller's session.
//   3. USE     — queries filter by the asserted child_id; writes stamp it explicitly.
// A client-supplied child_id is a *selection*, never authorization.
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, failWith } from './errors';

export const childIdSchema = z.string().uuid();

export interface TenantContext {
  childId: string;
  userId: string;
  role: 'parent' | 'child';
}

/** Resolve a child slug (URL param) to its id, scoped to the caller's tenants. */
export async function resolveChildSlug(slug: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('children')
    .select('id')
    .eq('slug', slug)
    .single();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
  return (data as { id: string }).id;
}

/**
 * Assert the caller may act on childId. Returns the TenantContext.
 * Throws TENANT_SCOPE_VIOLATION (403, never 404) on failure.
 */
export async function assertTenant(childId: string): Promise<TenantContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);

  // Membership check via the security-definer helper (single source of truth).
  const { data: childIds, error } = await supabase.rpc('current_child_ids');
  if (error) failWith(ErrorCodes.INTERNAL);
  const ids = (childIds ?? []) as string[];
  if (!ids.includes(childId)) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);

  const { data: access } = await supabase
    .from('child_access')
    .select('role')
    .eq('child_id', childId)
    .eq('user_id', user!.id)
    .single();

  return {
    childId,
    userId: user!.id,
    // M2 fix (2026-10-11): fail-CLOSED role default. A missing access row
    // means "least privilege" ('child'), never 'parent'. RLS remains the
    // real gate; this default must not silently elevate.
    role: ((access as { role: string } | null)?.role ?? 'child') as 'parent' | 'child',
  };
}

/** Assert parent role within the tenant. */
export async function assertParent(childId: string): Promise<TenantContext> {
  const ctx = await assertTenant(childId);
  if (ctx.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  return ctx;
}

export interface HouseholdContext {
  /** The household anchor — the owner user's id (spec §2.1: THE DECISION). */
  ownerUserId: string;
  /** Asserted child id — what auditEvent() receives (audit_event requires a child_id). */
  anchorChildId: string;
  userId: string;
  /** Caller role on the anchor child. Session fall-through (agent JWT with no
   *  child_access rows) resolves to 'child' — least privilege. The W13 worker
   *  batch path uses service_role with explicit owner scope instead. */
  role: 'parent' | 'child';
}

/**
 * Resolve the caller's household WITHOUT a client-supplied child id.
 * Anchor selection per spec §1.2:
 *   parent      → their default child (children.is_default), else first parent-role child
 *   child-role  → their single child
 *   agent/session fall-through → the job's first scoped child (via current_child_ids()), least privilege
 * The owner anchor is derived deterministically server-side via
 * household_owner_for_child() — the single source of truth, never client input.
 */
export async function assertHousehold(): Promise<HouseholdContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);

  const { data: childIds, error } = await supabase.rpc('current_child_ids');
  if (error) failWith(ErrorCodes.INTERNAL);
  const ids = ((childIds ?? []) as string[]);
  if (ids.length === 0) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);

  const { data: accesses } = await supabase
    .from('child_access')
    .select('child_id, role, created_at')
    .eq('user_id', user.id)
    .in('child_id', ids)
    .order('created_at', { ascending: true });
  const rows = (accesses ?? []) as { child_id: string; role: string }[];
  const parentRows = rows.filter((r) => r.role === 'parent');
  const childRows = rows.filter((r) => r.role === 'child');

  let anchorChildId: string;
  let role: 'parent' | 'child';
  if (parentRows.length > 0) {
    role = 'parent';
    const { data: defaultChild } = await supabase
      .from('children')
      .select('id')
      .in('id', parentRows.map((r) => r.child_id))
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();
    anchorChildId = ((defaultChild as { id: string } | null)?.id ?? parentRows[0].child_id);
  } else if (childRows.length > 0) {
    role = 'child';
    anchorChildId = childRows[0].child_id;
  } else {
    role = 'child';
    anchorChildId = ids[0];
  }
  if (!ids.includes(anchorChildId)) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);

  const { data: owner, error: ownerError } = await supabase.rpc(
    'household_owner_for_child',
    { p_child_id: anchorChildId },
  );
  if (ownerError || !owner) failWith(ErrorCodes.INTERNAL);

  return { ownerUserId: owner as string, anchorChildId, userId: user.id, role };
}

/** Assert parent role within the household (no child id involved). */
export async function assertHouseholdParent(): Promise<HouseholdContext> {
  const ctx = await assertHousehold();
  if (ctx.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  return ctx;
}

/* ------------------------------------------------------------------ */
/* W22/W23 health subjects (MODULE-ARCHITECTURE-BATCH2 §3/§4)          */
/* ------------------------------------------------------------------ */

export interface HealthSubjectContext extends TenantContext {
  /** health_subjects.id (the registry row, not children.id). */
  subjectRowId: string;
  /** children.id when subject_kind='child'; null for adult subjects. */
  subjectChildId: string | null;
  /** True when the caller IS the subject (teen reading own data). */
  isSelf: boolean;
  /** Subject's age in years from dob; null when dob is unknown. */
  subjectAge: number | null;
}

interface HealthSubjectRow {
  id: string;
  owner_user_id: string;
  subject_id: string;
  subject_kind: 'child' | 'adult';
  label: string;
  dob: string | null;
}

/**
 * Assert the caller may act on a health subject. Appends (never replaces)
 * the tenant/household helpers above.
 *
 * Resolve: subject registry row id → the underlying child (for child
 * subjects). Assert: that child is in the caller's current_child_ids()
 * (child_access stays the single source of truth). Use: RLS on the health
 * tables enforces the per-metric visibility predicate; this helper only
 * establishes tenant scope + role + selfhood for route logic.
 */
export async function assertHealthSubject(
  subjectRowId: string,
): Promise<HealthSubjectContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);

  const { data: row, error } = await supabase
    .from('health_subjects')
    .select('id, owner_user_id, subject_id, subject_kind, label, dob')
    .eq('id', subjectRowId)
    .single();
  if (error || !row) failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  const subject = row as HealthSubjectRow;

  const subjectChildId =
    subject.subject_kind === 'child' ? subject.subject_id : null;

  let ctx: TenantContext;
  if (subjectChildId) {
    // Child subject: tenant scope via the child's membership.
    ctx = await assertTenant(subjectChildId);
  } else {
    // Adult subject: anchored to the owner's household; the owner is the
    // subject, so role is whatever the household context says.
    const household = await assertHousehold();
    if (household.ownerUserId !== subject.owner_user_id) {
      failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
    }
    ctx = {
      childId: household.anchorChildId,
      userId: user.id,
      role: household.role,
    };
  }

  const isSelf =
    subject.subject_kind === 'adult'
      ? subject.owner_user_id === user.id
      : await isSubjectSelf(supabase, subjectChildId!, user.id);

  let subjectAge: number | null = null;
  if (subject.dob) {
    const dob = new Date(subject.dob + 'T00:00:00Z');
    const now = new Date();
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    const m = now.getUTCMonth() - dob.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
    subjectAge = age;
  }

  return { ...ctx, subjectRowId: subject.id, subjectChildId, isSelf, subjectAge };
}

/** True when the caller is the teen themself (child-role access row). */
async function isSubjectSelf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  childId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('child_access')
    .select('role')
    .eq('child_id', childId)
    .eq('user_id', userId)
    .single();
  return (data as { role: string } | null)?.role === 'child';
}
