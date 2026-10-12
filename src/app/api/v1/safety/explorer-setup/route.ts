// /api/v1/safety/explorer-setup — FR-SAFETY-007 outing gate status.
// GET: returns whether the caller's teen (13-15) has completed Explorer Setup.
// The gate is required before 13-15 year olds can save outing plans or access
// independent Out & About features. 16+ are exempt (lighter client-tracked version).
import { apiHandler } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

export const GET = apiHandler({}, async (ctx) => {
  const supabase = await createClient();
  
  // Check if caller is a teen (has child_access role='child')
  const { data: access } = await supabase
    .from('child_access')
    .select('child_id')
    .eq('user_id', ctx.userId)
    .eq('role', 'child')
    .limit(1)
    .maybeSingle();
  
  if (!access) {
    // Not a teen — gate doesn't apply
    return { gateRequired: false, gateCompleted: true };
  }
  
  // Get the child's age and explorer setup status
  const { data: child } = await supabase
    .from('children')
    .select('id, date_of_birth, explorer_setup_completed_at')
    .eq('id', (access as { child_id: string }).child_id)
    .single();
  
  if (!child) {
    return { gateRequired: false, gateCompleted: true };
  }
  
  const c = child as { date_of_birth: string | null; explorer_setup_completed_at: string | null };
  
  // Calculate age
  let age = 99;
  if (c.date_of_birth) {
    const dob = new Date(c.date_of_birth);
    const now = new Date();
    age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  }
  
  // Gate required for 13-15, not for 16+
  const gateRequired = age >= 13 && age <= 15;
  const gateCompleted = !!c.explorer_setup_completed_at;
  
  return { gateRequired, gateCompleted, age };
});
