// Tenant resolution + assertion. The pattern for EVERY backend entry point:
//   1. RESOLVE — obtain child_id (slug→id, body field, job payload).
//   2. ASSERT  — child_id = ANY(current_child_ids()) for the caller's session.
//   3. USE     — queries filter by the asserted child_id; writes stamp it explicitly.
// A client-supplied child_id is a *selection*, never authorization.
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, trpcError } from './errors';

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
  if (error || !data) trpcError(ErrorCodes.NOT_FOUND, 'NOT_FOUND');
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
  if (!user) trpcError(ErrorCodes.TENANT_SCOPE_VIOLATION, 'FORBIDDEN');

  // Membership check via the security-definer helper (single source of truth).
  const { data: childIds, error } = await supabase.rpc('current_child_ids');
  if (error) trpcError(ErrorCodes.INTERNAL);
  const ids = (childIds ?? []) as string[];
  if (!ids.includes(childId)) trpcError(ErrorCodes.TENANT_SCOPE_VIOLATION, 'FORBIDDEN');

  const { data: access } = await supabase
    .from('child_access')
    .select('role')
    .eq('child_id', childId)
    .eq('user_id', user!.id)
    .single();

  return {
    childId,
    userId: user!.id,
    role: ((access as { role: string } | null)?.role ?? 'parent') as 'parent' | 'child',
  };
}

/** Assert parent role within the tenant. */
export async function assertParent(childId: string): Promise<TenantContext> {
  const ctx = await assertTenant(childId);
  if (ctx.role !== 'parent') trpcError(ErrorCodes.PARENT_ROLE_REQUIRED, 'FORBIDDEN');
  return ctx;
}
