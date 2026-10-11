// Service-role admin client — SERVER ONLY. Throws if the key is missing or if this
// module is ever bundled for the client (NEXT_PUBLIC guard). Every query through
// this client MUST carry and assert an explicit child_id (RLS is bypassed).
import { createClient } from '@supabase/supabase-js';

if (typeof window !== 'undefined') {
  throw new Error('supabase/admin imported in a client bundle — forbidden.');
}

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceRoleKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
