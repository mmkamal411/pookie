// Service-role admin client — SERVER ONLY. Lazily initialized: the client is
// created on first USE, not at import time, so `next build`'s route collection
// never evaluates a missing key. The missing-key and client-bundle guards
// raise on first use instead. Every query through this client MUST carry and
// assert an explicit child_id (RLS is bypassed).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('supabase/admin imported in a client bundle — forbidden.');
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  }
  if (!cached) {
    cached = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

/**
 * Lazily-initialized service-role client. Import-time safe; all existing call
 * sites (`supabaseAdmin.from(...)`, `supabaseAdmin.storage...`) work unchanged.
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getAdminClient();
    const value = (client as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
