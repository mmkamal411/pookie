// service_role machine-path pattern. RLS is bypassed on this client, so every
// function here takes an explicit allowlist and asserts child_id membership
// BEFORE querying. Never derive child_id from client input alone.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { failWith, ErrorCodes } from './errors';

/**
 * Fetch a child row on behalf of a worker job.
 * @param jobChildAllowlist child_ids the job is authorized for (from the job row / worker_children)
 */
export async function machineGetChild(jobChildAllowlist: string[], childId: string) {
  if (!jobChildAllowlist.includes(childId)) {
    failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  }
  const { data, error } = await supabaseAdmin
    .from('children')
    .select('id, first_name, slug, timezone')
    .eq('id', childId)
    .single();
  if (error) throw error;
  return data;
}
